import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import type {
  MetadataListRequest,
  MetadataListResponse,
} from '@/types/metadata'

/**
 * Get file metadata with filtering and pagination
 */
export async function GET(request: NextRequest) {
  try {
    logger.info('Metadata list request received', 'api:metadata')

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

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const queryParams: MetadataListRequest = {
      folder_id: searchParams.get('folder_id') || undefined,
      type:
        (searchParams.get('type') as 'torrent' | 'file' | 'streaming') ||
        undefined,
      status: searchParams.get('status') || undefined,
      search: searchParams.get('search') || undefined,
      limit: parseInt(searchParams.get('limit') || '50'),
      offset: parseInt(searchParams.get('offset') || '0'),
    }

    // Validate limit
    if (queryParams.limit < 1 || queryParams.limit > 100) {
      return NextResponse.json(
        { error: 'Limit must be between 1 and 100' },
        { status: 400 }
      )
    }

    // Build the query
    let query = supabase.from('file_metadata').select('*', { count: 'exact' })

    // Get user's real_debrid_id for RLS filtering
    const { data: userData } = await supabase
      .from('users')
      .select('real_debrid_id')
      .eq('id', user.id)
      .single()

    if (!userData) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      )
    }

    // Apply filters
    if (queryParams.type) {
      query = query.eq('type', queryParams.type)
    }

    if (queryParams.status) {
      query = query.eq('status', queryParams.status)
    }

    if (queryParams.search) {
      query = query.ilike('name', `%${queryParams.search}%`)
    }

    if (queryParams.folder_id) {
      // Join with file_folder_assignments to filter by folder
      query = query
        .select('file_metadata.*', { count: 'exact' })
        .join(
          'inner',
          'file_folder_assignments',
          'file_metadata.id = file_folder_assignments.file_id'
        )
        .eq('file_folder_assignments.folder_id', queryParams.folder_id)
    }

    // Apply ordering and pagination
    query = query
      .order('created_at', { ascending: false })
      .range(queryParams.offset, queryParams.offset + queryParams.limit - 1)

    const { data: items, error, count } = await query

    if (error) {
      logger.error('Failed to fetch metadata', 'api:metadata', {
        error: error.message,
        userId: user.id,
      })
      return NextResponse.json(
        { error: 'Failed to fetch metadata' },
        { status: 500 }
      )
    }

    const response: MetadataListResponse = {
      items: items || [],
      total: count || 0,
      has_more: queryParams.offset + queryParams.limit < (count || 0),
    }

    logger.info('Metadata retrieved successfully', 'api:metadata', {
      userId: user.id,
      itemCount: items?.length || 0,
      total: count || 0,
    })

    return NextResponse.json(response)
  } catch (error) {
    logger.error('Metadata list request failed', 'api:metadata', {
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Failed to retrieve metadata',
      },
      { status: 500 }
    )
  }
}

/**
 * Create new file metadata (usually not needed, metadata is created via sync)
 */
export async function POST(request: NextRequest) {
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

    const metadataData = await request.json()

    // Add user_id and default sync status
    const newMetadata = {
      ...metadataData,
      user_id: user.id,
      sync_status: {
        last_sync: new Date().toISOString(),
        sync_state: 'synced',
        retry_count: 0,
        sync_version: 1,
      },
      last_sync: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('file_metadata')
      .insert(newMetadata)
      .select()
      .single()

    if (error) {
      logger.error('Failed to create metadata', 'api:metadata', {
        error: error.message,
        userId: user.id,
      })
      return NextResponse.json(
        { error: 'Failed to create metadata' },
        { status: 500 }
      )
    }

    logger.info('Metadata created successfully', 'api:metadata', {
      userId: user.id,
      metadataId: data.id,
    })

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    logger.error('Create metadata request failed', 'api:metadata', {
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Failed to create metadata',
      },
      { status: 500 }
    )
  }
}
