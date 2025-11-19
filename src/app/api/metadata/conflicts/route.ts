import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import type { ConflictResolutionRequest } from '@/types/metadata'

/**
 * Get sync conflicts for the current user
 */
export async function GET(request: NextRequest) {
  try {
    logger.info('Get sync conflicts request received', 'api:metadata-conflicts')

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
    const status = searchParams.get('status') // 'pending', 'resolved', etc.
    const limit = parseInt(searchParams.get('limit') || '50')

    // Validate limit
    if (limit < 1 || limit > 100) {
      return NextResponse.json(
        { error: 'Limit must be between 1 and 100' },
        { status: 400 }
      )
    }

    // Build the query
    let query = supabase
      .from('sync_conflicts')
      .select(
        `
        *,
        file_metadata:file_id (
          id,
          name,
          type,
          size
        )
      `,
        { count: 'exact' }
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    // Filter by status if provided
    if (status) {
      query = query.eq('resolution_status', status)
    }

    const { data, error, count } = await query

    if (error) {
      logger.error('Failed to fetch sync conflicts', 'api:metadata-conflicts', {
        error: error.message,
        userId: user.id,
      })
      return NextResponse.json(
        { error: 'Failed to fetch sync conflicts' },
        { status: 500 }
      )
    }

    logger.info(
      'Sync conflicts retrieved successfully',
      'api:metadata-conflicts',
      {
        userId: user.id,
        conflictCount: data?.length || 0,
      }
    )

    return NextResponse.json({
      conflicts: data || [],
      total: count || 0,
    })
  } catch (error) {
    logger.error(
      'Get sync conflicts request failed',
      'api:metadata-conflicts',
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    )

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Failed to retrieve sync conflicts',
      },
      { status: 500 }
    )
  }
}

/**
 * Resolve a sync conflict
 */
export async function POST(request: NextRequest) {
  try {
    logger.info(
      'Resolve sync conflict request received',
      'api:metadata-conflicts'
    )

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

    const body: ConflictResolutionRequest = await request.json()

    // Validate request body
    if (!body.conflict_id || !body.resolution) {
      return NextResponse.json(
        { error: 'conflict_id and resolution are required' },
        { status: 400 }
      )
    }

    // Validate resolution type
    const validResolutions = ['keep_local', 'keep_remote', 'merge']
    if (!validResolutions.includes(body.resolution)) {
      return NextResponse.json(
        {
          error: `Invalid resolution. Must be one of: ${validResolutions.join(', ')}`,
        },
        { status: 400 }
      )
    }

    // Get the conflict and verify user owns it
    const { data: conflict, error: fetchError } = await supabase
      .from('sync_conflicts')
      .select('*')
      .eq('id', body.conflict_id)
      .single()

    if (fetchError || !conflict) {
      return NextResponse.json({ error: 'Conflict not found' }, { status: 404 })
    }

    if (conflict.user_id !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Process the resolution based on the conflict type
    await this.processConflictResolution(conflict, body)

    // Update conflict status
    const { error: updateError } = await supabase
      .from('sync_conflicts')
      .update({
        resolution_status: `resolved_${body.resolution}`,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', body.conflict_id)

    if (updateError) {
      throw new Error(`Failed to update conflict: ${updateError.message}`)
    }

    logger.info(
      'Sync conflict resolved successfully',
      'api:metadata-conflicts',
      {
        userId: user.id,
        conflictId: body.conflict_id,
        resolution: body.resolution,
      }
    )

    return NextResponse.json({
      message: 'Conflict resolved successfully',
      conflict_id: body.conflict_id,
      resolution: body.resolution,
    })
  } catch (error) {
    logger.error(
      'Resolve sync conflict request failed',
      'api:metadata-conflicts',
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    )

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Failed to resolve sync conflict',
      },
      { status: 500 }
    )
  }
}

/**
 * Process different types of conflict resolutions
 */
async function processConflictResolution(
  conflict: any,
  request: ConflictResolutionRequest
): Promise<void> {
  const supabase = createServerClient()

  switch (conflict.conflict_type) {
    case 'name_conflict':
      await processNameConflict(conflict, request)
      break

    case 'size_conflict':
      await processSizeConflict(conflict, request)
      break

    case 'status_conflict':
      await processStatusConflict(conflict, request)
      break

    case 'metadata_conflict':
      await processMetadataConflict(conflict, request)
      break

    default:
      throw new Error(`Unknown conflict type: ${conflict.conflict_type}`)
  }
}

/**
 * Process name conflicts
 */
async function processNameConflict(
  conflict: any,
  request: ConflictResolutionRequest
): Promise<void> {
  const supabase = createServerClient()

  if (request.resolution === 'keep_local') {
    // No action needed, local data is already in database
    return
  }

  if (request.resolution === 'keep_remote') {
    // Update with remote value
    const { error } = await supabase
      .from('file_metadata')
      .update({
        name: conflict.remote_value.name,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conflict.file_id)

    if (error) {
      throw new Error(`Failed to update name: ${error.message}`)
    }
  }

  if (request.resolution === 'merge' && request.merged_data) {
    const { error } = await supabase
      .from('file_metadata')
      .update({
        name: request.merged_data.name,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conflict.file_id)

    if (error) {
      throw new Error(`Failed to merge name: ${error.message}`)
    }
  }
}

/**
 * Process size conflicts
 */
async function processSizeConflict(
  conflict: any,
  request: ConflictResolutionRequest
): Promise<void> {
  const supabase = createServerClient()

  if (request.resolution === 'keep_remote') {
    // Update with remote size
    const { error } = await supabase
      .from('file_metadata')
      .update({
        size: conflict.remote_value.size,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conflict.file_id)

    if (error) {
      throw new Error(`Failed to update size: ${error.message}`)
    }
  }

  if (request.resolution === 'merge' && request.merged_data) {
    const { error } = await supabase
      .from('file_metadata')
      .update({
        size: request.merged_data.size,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conflict.file_id)

    if (error) {
      throw new Error(`Failed to merge size: ${error.message}`)
    }
  }
  // For 'keep_local', no action needed
}

/**
 * Process status conflicts
 */
async function processStatusConflict(
  conflict: any,
  request: ConflictResolutionRequest
): Promise<void> {
  const supabase = createServerClient()

  if (request.resolution === 'keep_remote') {
    // Update with remote status
    const { error } = await supabase
      .from('file_metadata')
      .update({
        status: conflict.remote_value.status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conflict.file_id)

    if (error) {
      throw new Error(`Failed to update status: ${error.message}`)
    }
  }

  if (request.resolution === 'merge' && request.merged_data) {
    const { error } = await supabase
      .from('file_metadata')
      .update({
        status: request.merged_data.status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conflict.file_id)

    if (error) {
      throw new Error(`Failed to merge status: ${error.message}`)
    }
  }
  // For 'keep_local', no action needed
}

/**
 * Process metadata conflicts (flexible conflicts)
 */
async function processMetadataConflict(
  conflict: any,
  request: ConflictResolutionRequest
): Promise<void> {
  const supabase = createServerClient()

  if (request.resolution === 'keep_remote') {
    // Update with remote properties
    const { error } = await supabase
      .from('file_metadata')
      .update({
        properties: conflict.remote_value.properties,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conflict.file_id)

    if (error) {
      throw new Error(`Failed to update properties: ${error.message}`)
    }
  }

  if (request.resolution === 'merge' && request.merged_data) {
    const { error } = await supabase
      .from('file_metadata')
      .update({
        properties: request.merged_data.properties,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conflict.file_id)

    if (error) {
      throw new Error(`Failed to merge properties: ${error.message}`)
    }
  }
  // For 'keep_local', no action needed
}
