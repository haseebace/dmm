import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { metadataSyncEngine } from '@/lib/sync/engine-simple'
import { logger } from '@/lib/logger'
import type { SyncRequest, SyncResponse } from '@/types/metadata'

/**
 * Start a metadata synchronization operation
 */
export async function POST(request: NextRequest) {
  try {
    logger.info('Metadata sync request received', 'api:metadata-sync')

    // Get the current user from Supabase
    const supabase = createServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get user's Real-Debrid access token
    const { data: tokens, error: tokenError } = await supabase
      .from('oauth_tokens')
      .select('access_token')
      .eq('user_id', user.id)
      .single()

    if (tokenError || !tokens?.access_token) {
      return NextResponse.json(
        { error: 'Real-Debrid access token not found' },
        { status: 400 }
      )
    }

    // Parse request body
    const body: SyncRequest = await request.json()

    // Start synchronization
    let result
    const operationType = body.operation_type || 'full_sync'

    if (operationType === 'incremental_sync') {
      // For incremental sync, we need a 'since' date
      const since = new Date()
      since.setHours(since.getHours() - 24) // Default to last 24 hours

      result = await metadataSyncEngine.startIncrementalSync(
        user.id,
        tokens.access_token,
        since,
        body.options
      )
    } else {
      // Full sync
      result = await metadataSyncEngine.startFullSync(
        user.id,
        tokens.access_token,
        body.options
      )
    }

    const response: SyncResponse = {
      operation_id: result.operation_id,
      status: result.success ? 'started' : 'failed',
      message: result.success
        ? 'Metadata synchronization started successfully'
        : `Sync failed: ${result.errors.join(', ')}`,
    }

    logger.info('Metadata sync operation started', 'api:metadata-sync', {
      userId: user.id,
      operationId: result.operation_id,
      operationType,
      success: result.success,
    })

    return NextResponse.json(response, { status: 200 })
  } catch (error) {
    logger.error('Metadata sync request failed', 'api:metadata-sync', {
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Failed to start metadata synchronization',
      },
      { status: 500 }
    )
  }
}

/**
 * Get sync status or list recent sync operations
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const operationId = searchParams.get('operation_id')

    if (operationId) {
      // Get specific operation status
      const syncStatus = await metadataSyncEngine.getSyncStatus(operationId)

      if (!syncStatus) {
        return NextResponse.json(
          { error: 'Sync operation not found' },
          { status: 404 }
        )
      }

      // Verify user owns this operation
      if (syncStatus.user_id !== user.id) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 })
      }

      return NextResponse.json(syncStatus)
    } else {
      // Get user's sync history
      const limit = parseInt(searchParams.get('limit') || '10')
      const syncHistory = await metadataSyncEngine.getUserSyncHistory(
        user.id,
        limit
      )

      return NextResponse.json({
        operations: syncHistory,
        total: syncHistory.length,
      })
    }
  } catch (error) {
    logger.error('Get sync status failed', 'api:metadata-sync', {
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Failed to retrieve sync status',
      },
      { status: 500 }
    )
  }
}

/**
 * Cancel a sync operation
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const operationId = searchParams.get('operation_id')

    if (!operationId) {
      return NextResponse.json(
        { error: 'operation_id parameter required' },
        { status: 400 }
      )
    }

    // Verify user owns this operation
    const syncStatus = await metadataSyncEngine.getSyncStatus(operationId)
    if (!syncStatus) {
      return NextResponse.json(
        { error: 'Sync operation not found' },
        { status: 404 }
      )
    }

    if (syncStatus.user_id !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Cancel the operation
    await metadataSyncEngine.cancelSync(operationId)

    logger.info('Sync operation cancelled', 'api:metadata-sync', {
      userId: user.id,
      operationId,
    })

    return NextResponse.json({
      message: 'Sync operation cancelled successfully',
    })
  } catch (error) {
    logger.error('Cancel sync operation failed', 'api:metadata-sync', {
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Failed to cancel sync operation',
      },
      { status: 500 }
    )
  }
}
