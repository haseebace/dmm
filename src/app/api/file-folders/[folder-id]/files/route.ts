/**
 * GET /api/file-folders/[folder-id]/files
 *
 * Get all files assigned to a specific folder
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { FolderFilesResponse } from '@/types/file-folders'

interface RouteParams {
  params: {
    'folder-id': string
  }
}

/**
 * GET /api/file-folders/[folder-id]/files
 *
 * Get all files assigned to a specific folder with pagination and sorting
 *
 * Query parameters:
 * - userId: User ID (required)
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 50, max: 100)
 * - sort: Sort field (default: created_at)
 * - order: Sort order (asc/desc, default: desc)
 * - search: Search in filenames (optional)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const folderId = params['folder-id']
    const { searchParams } = new URL(request.url)

    const userId = searchParams.get('userId')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get('limit') || '50'))
    )
    const sort = searchParams.get('sort') || 'created_at'
    const order = searchParams.get('order') || 'desc'
    const search = searchParams.get('search')

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    if (!folderId || folderId === '[folder-id]') {
      return NextResponse.json(
        { error: 'Folder ID is required' },
        { status: 400 }
      )
    }

    // Validate sort field
    const validSortFields = [
      'created_at',
      'updated_at',
      'filename',
      'file_size',
      'virtual_filename',
    ]
    if (!validSortFields.includes(sort)) {
      return NextResponse.json(
        {
          error: `Invalid sort field: ${sort}. Valid fields: ${validSortFields.join(', ')}`,
        },
        { status: 400 }
      )
    }

    const supabase = createServerClient()

    // First check if folder belongs to user
    const { data: folder, error: folderError } = await supabase
      .from('folders')
      .select('id, name')
      .eq('id', folderId)
      .eq('user_id', userId)
      .single()

    if (folderError || !folder) {
      return NextResponse.json(
        { error: 'Folder not found or access denied' },
        { status: 404 }
      )
    }

    // Build query for files with assignments
    let query = supabase
      .from('file_folders')
      .select(
        `
        id,
        virtual_filename,
        created_at,
        updated_at,
        files (
          id,
          real_debrid_id,
          filename,
          file_size,
          mime_type,
          download_url,
          hoster,
          created_at,
          updated_at
        )
      `
      )
      .eq('folder_id', folderId)
      .eq('user_id', userId)

    // Add search filter if provided
    if (search) {
      query = query.or(`
        files.filename.ilike.%${search}%,
        virtual_filename.ilike.%${search}%
      `)
    }

    // Add sorting
    const sortField = sort.startsWith('files.') ? sort : `file_folders.${sort}`
    query = query.order(sortField, { ascending: order === 'asc' })

    // Add pagination
    const offset = (page - 1) * limit
    query = query.range(offset, offset + limit - 1)

    const { data: assignments, error, count } = await query

    if (error) {
      logger.error(
        'Failed to fetch folder files',
        'api/file-folders/[folder-id]/files',
        {
          userId,
          folderId,
          error: error.message,
        }
      )
      return NextResponse.json(
        { error: 'Failed to fetch folder files' },
        { status: 500 }
      )
    }

    // Transform data to include file info with assignment metadata
    const files = (assignments || []).map((assignment) => ({
      ...assignment.files,
      assignment_id: assignment.id,
      virtual_filename:
        assignment.virtual_filename || assignment.files?.filename,
      assigned_at: assignment.created_at,
      assignment_updated_at: assignment.updated_at,
    }))

    const total = count || 0
    const totalPages = Math.ceil(total / limit)

    const response: FolderFilesResponse = {
      files,
      total,
      folder_id: folderId,
      page,
      limit,
    }

    logger.info(
      'Folder files retrieved successfully',
      'api/file-folders/[folder-id]/files',
      {
        userId,
        folderId,
        fileCount: files.length,
        total,
        page,
        limit,
        search,
      }
    )

    // Add pagination headers
    const headers = new Headers({
      'X-Total-Count': total.toString(),
      'X-Total-Pages': totalPages.toString(),
      'X-Current-Page': page.toString(),
      'X-Items-Per-Page': limit.toString(),
    })

    return NextResponse.json(response, { headers })
  } catch (error) {
    logger.error(
      'Unexpected error in folder files API',
      'api/file-folders/[folder-id]/files',
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        folderId: params['folder-id'],
      }
    )

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
