/**
 * GET /api/status/connection
 *
 * Get current connection status for a user
 *
 * Query parameters:
 * - userId: User ID (required)
 * - includeHealthChecks: Include recent health check results (optional, default: false)
 * - includeDiagnostics: Include diagnostic information (optional, default: false)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import {
  ConnectionStatusData,
  HealthCheckResult,
  ConnectionDiagnostics,
} from '@/types/connection'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const includeHealthChecks =
      searchParams.get('includeHealthChecks') === 'true'
    const includeDiagnostics = searchParams.get('includeDiagnostics') === 'true'

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    const supabase = createServerClient()

    // Get current connection status
    const { data: status, error: statusError } = await supabase
      .from('connection_status')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (statusError && statusError.code !== 'PGRST116') {
      // Not found error
      logger.error(
        'Failed to fetch connection status',
        'api/connection-status',
        {
          userId,
          error: statusError.message,
        }
      )
      return NextResponse.json(
        { error: 'Failed to fetch connection status' },
        { status: 500 }
      )
    }

    let healthChecks: HealthCheckResult[] = []
    if (includeHealthChecks) {
      // Get recent health check results (last 10)
      const { data: healthCheckData, error: healthCheckError } = await supabase
        .from('health_check_results')
        .select('*')
        .eq('user_id', userId)
        .order('checked_at', { ascending: false })
        .limit(10)

      if (healthCheckError) {
        logger.error(
          'Failed to fetch health check results',
          'api/connection-status',
          {
            userId,
            error: healthCheckError.message,
          }
        )
      } else {
        healthChecks =
          healthCheckData?.map((result) => ({
            name: result.check_name,
            success: result.success,
            responseTime: result.response_time,
            statusCode: result.status_code,
            timestamp: new Date(result.checked_at),
            error: result.error_message,
            details: result.check_details,
          })) || []
      }
    }

    let diagnostics: ConnectionDiagnostics | null = null
    if (includeDiagnostics) {
      // Get latest diagnostic information
      const { data: diagnosticData, error: diagnosticError } = await supabase
        .from('connection_diagnostics')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (diagnosticError && diagnosticError.code !== 'PGRST116') {
        logger.error('Failed to fetch diagnostics', 'api/connection-status', {
          userId,
          error: diagnosticError.message,
        })
      } else if (diagnosticData) {
        diagnostics = diagnosticData.diagnostics as ConnectionDiagnostics
      }
    }

    // Map database status to ConnectionStatusData format
    const connectionStatus: ConnectionStatusData | null = status
      ? {
          authentication: {
            state: status.authentication_state,
            userId: status.user_id_rd,
            username: status.username,
            canRefresh: status.authentication_state !== 'unauthenticated',
            lastValidated: new Date(status.last_health_check),
            errorCode: status.status_code?.toString(),
            errorMessage: status.error_message,
          },
          service: {
            state: status.service_state,
            responseTime: status.response_time,
            errorRate: Number(status.error_rate),
            lastHealthCheck: new Date(status.last_health_check),
            consecutiveFailures: status.consecutive_errors,
            endpoints: status.properties?.endpoints || {},
            statusCode: status.status_code,
            errorMessage: status.error_message,
          },
          network: {
            state: status.network_state,
            online: status.network_state !== 'disconnected',
            latency: status.network_latency,
            effectiveType: status.properties?.network_type || 'unknown',
            lastChecked: new Date(status.last_health_check),
            connectionType: status.properties?.connection_type,
          },
          lastUpdated: new Date(status.updated_at),
          consecutiveErrors: status.consecutive_errors,
          overallStatus: status.overall_status as any,
        }
      : null

    const response = {
      status: connectionStatus,
      healthChecks,
      diagnostics,
      timestamp: new Date(),
      userId,
    }

    logger.info('Connection status retrieved', 'api/connection-status', {
      userId,
      hasStatus: !!connectionStatus,
      healthChecksCount: healthChecks.length,
      hasDiagnostics: !!diagnostics,
    })

    return NextResponse.json(response)
  } catch (error) {
    logger.error(
      'Unexpected error in connection status API',
      'api/connection-status',
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      }
    )

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
