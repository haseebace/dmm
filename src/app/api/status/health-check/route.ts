/**
 * POST /api/status/health-check
 *
 * Trigger manual health check for a user
 *
 * Body:
 * - userId: User ID (required)
 * - checkType: Type of check to perform (optional, default: 'all')
 *   Options: 'api', 'network', 'authentication', 'all'
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { HealthCheckResult } from '@/types/connection'

type CheckType = 'api' | 'network' | 'authentication' | 'all'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      userId,
      checkType = 'all',
    }: { userId: string; checkType?: CheckType } = body

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    if (!['api', 'network', 'authentication', 'all'].includes(checkType)) {
      return NextResponse.json(
        {
          error:
            'Invalid checkType. Must be one of: api, network, authentication, all',
        },
        { status: 400 }
      )
    }

    const supabase = createServerClient()

    // Perform health checks
    const results: HealthCheckResult[] = []

    // API health check
    if (checkType === 'all' || checkType === 'api') {
      try {
        const startTime = Date.now()

        // Get user's access token to test API connectivity
        const { data: tokens } = await supabase
          .from('user_tokens')
          .select('access_token')
          .eq('user_id', userId)
          .single()

        let apiResult: HealthCheckResult

        if (tokens?.access_token) {
          // Test Real-Debrid API connectivity
          const response = await fetch(
            'https://api.real-debrid.com/rest/1.0/user',
            {
              method: 'GET',
              headers: {
                Authorization: `Bearer ${tokens.access_token}`,
              },
              signal: AbortSignal.timeout(10000),
            }
          )

          apiResult = {
            name: 'realdebrid-api',
            success: response.ok,
            responseTime: Date.now() - startTime,
            statusCode: response.status,
            timestamp: new Date(),
            error: response.ok ? undefined : `HTTP ${response.status}`,
            details: {
              endpoint: '/user',
              statusCode: response.status,
            },
          }
        } else {
          apiResult = {
            name: 'realdebrid-api',
            success: false,
            responseTime: Date.now() - startTime,
            timestamp: new Date(),
            error: 'No access token available',
          }
        }

        results.push(apiResult)

        // Store in database
        await supabase.from('health_check_results').insert({
          user_id: userId,
          check_name: apiResult.name,
          success: apiResult.success,
          response_time: apiResult.responseTime,
          status_code: apiResult.statusCode,
          error_message: apiResult.error,
          check_details: apiResult.details || {},
        })
      } catch (error) {
        const apiResult: HealthCheckResult = {
          name: 'realdebrid-api',
          success: false,
          responseTime: 0,
          timestamp: new Date(),
          error: error instanceof Error ? error.message : 'Unknown error',
        }

        results.push(apiResult)

        // Store in database
        await supabase.from('health_check_results').insert({
          user_id: userId,
          check_name: apiResult.name,
          success: apiResult.success,
          response_time: apiResult.responseTime,
          error_message: apiResult.error,
        })
      }
    }

    // Network connectivity check
    if (checkType === 'all' || checkType === 'network') {
      try {
        const startTime = Date.now()
        const testUrls = [
          'https://www.google.com/favicon.ico',
          'https://www.cloudflare.com/favicon.ico',
        ]

        const testResults = await Promise.allSettled(
          testUrls.map(async (url) => {
            const responseStartTime = Date.now()
            try {
              const response = await fetch(url, {
                method: 'HEAD',
                signal: AbortSignal.timeout(5000),
              })

              return {
                url,
                success: response.ok,
                responseTime: Date.now() - responseStartTime,
                statusCode: response.status,
              }
            } catch (error) {
              return {
                url,
                success: false,
                responseTime: Date.now() - responseStartTime,
                error: error instanceof Error ? error.message : 'Unknown error',
              }
            }
          })
        )

        const successfulChecks = testResults.filter(
          (r) => r.status === 'fulfilled' && r.value.success
        ).length

        const networkResult: HealthCheckResult = {
          name: 'network-connectivity',
          success: successfulChecks > 0,
          responseTime: Date.now() - startTime,
          timestamp: new Date(),
          details: {
            connectivity: successfulChecks / testUrls.length,
            successfulChecks,
            totalChecks: testUrls.length,
            testResults: testResults.map((result) => {
              if (result.status === 'fulfilled') {
                return result.value
              } else {
                return {
                  url: 'unknown',
                  success: false,
                  responseTime: 0,
                  error:
                    result.reason instanceof Error
                      ? result.reason.message
                      : 'Unknown error',
                }
              }
            }),
          },
        }

        results.push(networkResult)

        // Store in database
        await supabase.from('health_check_results').insert({
          user_id: userId,
          check_name: networkResult.name,
          success: networkResult.success,
          response_time: networkResult.responseTime,
          error_message: networkResult.error,
          check_details: networkResult.details || {},
        })
      } catch (error) {
        const networkResult: HealthCheckResult = {
          name: 'network-connectivity',
          success: false,
          responseTime: 0,
          timestamp: new Date(),
          error: error instanceof Error ? error.message : 'Unknown error',
        }

        results.push(networkResult)

        // Store in database
        await supabase.from('health_check_results').insert({
          user_id: userId,
          check_name: networkResult.name,
          success: networkResult.success,
          response_time: networkResult.responseTime,
          error_message: networkResult.error,
        })
      }
    }

    // Authentication check
    if (checkType === 'all' || checkType === 'authentication') {
      try {
        const startTime = Date.now()

        // Get user's tokens
        const { data: tokens } = await supabase
          .from('user_tokens')
          .select('access_token, refresh_token')
          .eq('user_id', userId)
          .single()

        let authResult: HealthCheckResult

        if (tokens?.access_token) {
          try {
            // Test token validity with user endpoint
            const response = await fetch(
              'https://api.real-debrid.com/rest/1.0/user',
              {
                headers: {
                  Authorization: `Bearer ${tokens.access_token}`,
                },
                signal: AbortSignal.timeout(10000),
              }
            )

            if (response.ok) {
              const userData = await response.json()
              authResult = {
                name: 'authentication',
                success: true,
                responseTime: Date.now() - startTime,
                timestamp: new Date(),
                details: {
                  hasToken: true,
                  userId: userData.id,
                  username: userData.username,
                  premium: userData.premium,
                  expiresAt: userData.expiration,
                },
              }
            } else if (response.status === 401) {
              authResult = {
                name: 'authentication',
                success: false,
                responseTime: Date.now() - startTime,
                statusCode: response.status,
                timestamp: new Date(),
                error: 'Token expired or invalid',
                details: {
                  hasToken: true,
                  statusCode: response.status,
                },
              }
            } else {
              authResult = {
                name: 'authentication',
                success: false,
                responseTime: Date.now() - startTime,
                statusCode: response.status,
                timestamp: new Date(),
                error: `HTTP ${response.status}`,
                details: {
                  hasToken: true,
                  statusCode: response.status,
                },
              }
            }
          } catch (fetchError) {
            authResult = {
              name: 'authentication',
              success: false,
              responseTime: Date.now() - startTime,
              timestamp: new Date(),
              error:
                fetchError instanceof Error
                  ? fetchError.message
                  : 'Unknown error',
              details: {
                hasToken: true,
              },
            }
          }
        } else {
          authResult = {
            name: 'authentication',
            success: false,
            responseTime: Date.now() - startTime,
            timestamp: new Date(),
            error: 'No access token available',
            details: {
              hasToken: false,
            },
          }
        }

        results.push(authResult)

        // Store in database
        await supabase.from('health_check_results').insert({
          user_id: userId,
          check_name: authResult.name,
          success: authResult.success,
          response_time: authResult.responseTime,
          status_code: authResult.statusCode,
          error_message: authResult.error,
          check_details: authResult.details || {},
        })
      } catch (error) {
        const authResult: HealthCheckResult = {
          name: 'authentication',
          success: false,
          responseTime: 0,
          timestamp: new Date(),
          error: error instanceof Error ? error.message : 'Unknown error',
        }

        results.push(authResult)

        // Store in database
        await supabase.from('health_check_results').insert({
          user_id: userId,
          check_name: authResult.name,
          success: authResult.success,
          response_time: authResult.responseTime,
          error_message: authResult.error,
        })
      }
    }

    logger.info('Manual health check completed', 'api/health-check', {
      userId,
      checkType,
      resultsCount: results.length,
      successCount: results.filter((r) => r.success).length,
    })

    return NextResponse.json({
      success: true,
      results,
      summary: {
        total: results.length,
        successful: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success).length,
      },
      timestamp: new Date(),
    })
  } catch (error) {
    logger.error('Unexpected error in health check API', 'api/health-check', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    })

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
