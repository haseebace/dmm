/**
 * POST /api/status/reconnect
 *
 * Trigger manual reconnection for a user
 *
 * Body:
 * - userId: User ID (required)
 * - reason: Reconnection reason (optional, default: 'manual')
 * - maxAttempts: Maximum reconnection attempts (optional)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { ReconnectionContext, ReconnectionResult } from '@/types/connection'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      userId,
      reason = 'manual',
      maxAttempts,
    }: {
      userId: string
      reason?: ReconnectionContext['reason']
      maxAttempts?: number
    } = body

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    if (
      ![
        'authentication',
        'service_unavailable',
        'network_disconnect',
        'manual',
      ].includes(reason)
    ) {
      return NextResponse.json(
        {
          error:
            'Invalid reason. Must be one of: authentication, service_unavailable, network_disconnect, manual',
        },
        { status: 400 }
      )
    }

    const supabase = createServerClient()
    const startTime = Date.now()

    // Get current connection status
    const { data: currentStatus, error: statusError } = await supabase
      .from('connection_status')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (statusError && statusError.code !== 'PGRST116') {
      logger.error('Failed to fetch current status', 'api/reconnect', {
        userId,
        error: statusError.message,
      })
      return NextResponse.json(
        { error: 'Failed to fetch current connection status' },
        { status: 500 }
      )
    }

    if (!currentStatus) {
      return NextResponse.json(
        { error: 'No current connection status found' },
        { status: 404 }
      )
    }

    // Log reconnection attempt
    await supabase.from('connection_events').insert({
      user_id: userId,
      event_type: 'reconnection_attempt',
      previous_state: currentStatus.overall_status,
      new_state: null,
      event_data: {
        reason,
        maxAttempts,
        timestamp: new Date(),
        triggeredBy: 'api_request',
      },
      severity: 'info',
      category: 'reconnection',
    })

    // Get user's tokens for reconnection
    const { data: tokens } = await supabase
      .from('user_tokens')
      .select('access_token, refresh_token')
      .eq('user_id', userId)
      .single()

    if (!tokens) {
      await supabase.from('connection_events').insert({
        user_id: userId,
        event_type: 'reconnection_failed',
        previous_state: currentStatus.overall_status,
        new_state: 'error',
        event_data: {
          reason: 'no_tokens',
          duration: Date.now() - startTime,
          attempts: 0,
        },
        severity: 'error',
        category: 'reconnection',
      })

      return NextResponse.json({
        success: false,
        error: 'No authentication tokens available',
        attempts: 0,
        duration: Date.now() - startTime,
      })
    }

    // Perform reconnection attempts
    const maxRetryAttempts = maxAttempts || 10
    let attempts = 0
    let success = false
    let lastError: string | undefined

    for (let attempt = 1; attempt <= maxRetryAttempts; attempt++) {
      attempts = attempt

      try {
        // Exponential backoff with jitter
        const baseDelay = 1000
        const maxDelay = 30000
        const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay)
        const jitter = Math.random() * delay * 0.1
        const finalDelay = delay + jitter

        if (attempt > 1) {
          await new Promise((resolve) => setTimeout(resolve, finalDelay))
        }

        // Try different reconnection strategies based on attempt number and reason
        let reconnectionSuccess = false

        if (reason === 'authentication' || attempt === 1) {
          // Try token refresh first
          reconnectionSuccess = await tryTokenRefresh(
            tokens.refresh_token,
            userId,
            supabase
          )
        }

        if (!reconnectionSuccess && attempt <= 3) {
          // Test current token
          reconnectionSuccess = await testCurrentToken(
            tokens.access_token,
            userId,
            supabase
          )
        }

        if (!reconnectionSuccess && attempt <= 5) {
          // Try network connectivity test
          const networkOk = await testNetworkConnectivity()
          if (networkOk) {
            reconnectionSuccess = await testCurrentToken(
              tokens.access_token,
              userId,
              supabase
            )
          }
        }

        if (reconnectionSuccess) {
          success = true

          // Update connection status to connected
          await supabase.from('connection_status').upsert({
            user_id: userId,
            overall_status: 'connected',
            service_state: 'available',
            network_state: 'connected',
            authentication_state: 'authenticated',
            last_health_check: new Date(),
            consecutive_errors: 0,
            response_time: 0,
            error_rate: 0,
            updated_at: new Date(),
          })

          // Log successful reconnection
          await supabase.from('connection_events').insert({
            user_id: userId,
            event_type: 'reconnection_success',
            previous_state: currentStatus.overall_status,
            new_state: 'connected',
            event_data: {
              reason,
              attempts: attempt,
              duration: Date.now() - startTime,
              strategy: attempt === 1 ? 'token_refresh' : 'retry',
            },
            severity: 'info',
            category: 'reconnection',
          })

          logger.info('Reconnection successful', 'api/reconnect', {
            userId,
            reason,
            attempts: attempt,
            duration: Date.now() - startTime,
          })

          break
        }

        lastError = `Attempt ${attempt} failed`
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error'
        logger.warn('Reconnection attempt failed', 'api/reconnect', {
          userId,
          attempt,
          error: lastError,
        })
      }
    }

    const duration = Date.now() - startTime
    const result: ReconnectionResult = {
      success,
      attempts,
      duration,
      error: success ? undefined : lastError,
      strategy: reason === 'authentication' ? 'token_refresh' : 'retry',
    }

    if (!success) {
      // Update connection status to error
      await supabase.from('connection_status').upsert({
        user_id: userId,
        overall_status: 'error',
        last_health_check: new Date(),
        consecutive_errors: (currentStatus.consecutive_errors || 0) + 1,
        error_message: lastError,
        updated_at: new Date(),
      })

      // Log failed reconnection
      await supabase.from('connection_events').insert({
        user_id: userId,
        event_type: 'reconnection_failed',
        previous_state: currentStatus.overall_status,
        new_state: 'error',
        event_data: {
          reason,
          attempts,
          duration,
          lastError,
        },
        severity: 'error',
        category: 'reconnection',
      })

      logger.error('Reconnection failed after all attempts', 'api/reconnect', {
        userId,
        reason,
        attempts,
        duration,
        lastError,
      })
    }

    return NextResponse.json(result)
  } catch (error) {
    logger.error('Unexpected error in reconnection API', 'api/reconnect', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    })

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        attempts: 0,
        duration: 0,
      },
      { status: 500 }
    )
  }
}

// Helper functions
async function tryTokenRefresh(
  refreshToken: string | null | undefined,
  userId: string,
  supabase: any
): Promise<boolean> {
  if (!refreshToken) {
    return false
  }

  try {
    const response = await fetch('https://api.real-debrid.com/oauth/v2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.REAL_DEBRID_CLIENT_ID!,
        client_secret: process.env.REAL_DEBRID_CLIENT_SECRET!,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    })

    if (response.ok) {
      const tokenData = await response.json()

      // Update stored tokens
      await supabase.from('user_tokens').upsert({
        user_id: userId,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || refreshToken,
        token_type: tokenData.token_type,
        expires_in: tokenData.expires_in,
        updated_at: new Date(),
      })

      return true
    }
  } catch (error) {
    logger.warn('Token refresh failed', 'api/reconnect', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }

  return false
}

async function testCurrentToken(
  accessToken: string,
  userId: string,
  supabase: any
): Promise<boolean> {
  try {
    const response = await fetch('https://api.real-debrid.com/rest/1.0/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      signal: AbortSignal.timeout(10000),
    })

    return response.ok
  } catch (error) {
    logger.warn('Token test failed', 'api/reconnect', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    return false
  }
}

async function testNetworkConnectivity(): Promise<boolean> {
  try {
    const response = await fetch('https://www.google.com/favicon.ico', {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000),
    })
    return response.ok
  } catch (error) {
    return false
  }
}
