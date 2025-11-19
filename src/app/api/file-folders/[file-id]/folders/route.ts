/**
 * GET /api/file-folders/[file-id]/folders
 *
 * Get all folders a file is assigned to
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { FileFoldersResponse } from '@/types/file-folders'

interface RouteParams {
  params: {
    'file-id': string
  }
}

/**
 * GET /api/file-folders/[file-id]/folders
 *
 * Get all folders a file is assigned to
 *
 * Query parameters:
 * - userId: User ID (required)
 * - includeHierarchy: Include folder hierarchy (default: true)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const fileId = params['file-id']
    const { searchParams } = new URL(request.url)

    const userId = searchParams.get('userId')
    const includeHierarchy = searchParams.get('includeHierarchy') !== 'false'

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    if (!fileId || fileId === '[file-id]') {
      return NextResponse.json(
        { error: 'File ID is required' },
        { status: 400 }
      )
    }

    const supabase = createServerClient()

    // First check if file belongs to user
    const { data: file, error: fileError } = await supabase
      .from('files')
      .select('id, filename')
      .eq('id', fileId)
      .eq('user_id', userId)
      .single()

    if (fileError || !file) {
      return NextResponse.json(
        { error: 'File not found or access denied' },
        { status: 404 }
      )
    }

    // Get folder assignments
    const { data: assignments, error } = await supabase
      .from('file_folders')
      .select(
        `
        id,
        virtual_filename,
        created_at,
        updated_at,
        folders (
          id,
          name,
          description,
          color,
          parent_id,
          sort_order,
          created_at,
          updated_at
        )
      `
      )
      .eq('file_id', fileId)
      .eq('user_id', userId)
      .order('folders.sort_order', { ascending: true })

    if (error) {
      logger.error(
        'Failed to fetch file folders',
        'api/file-folders/[file-id]/folders',
        {
          userId,
          fileId,
          error: error.message,
        }
      )
      return NextResponse.json(
        { error: 'Failed to fetch file folders' },
        { status: 500 }
      )
    }

    // Extract folders and add assignment metadata
    const folders = (assignments || []).map((assignment) => ({
      ...assignment.folders,
      assignment_id: assignment.id,
      virtual_filename: assignment.virtual_filename,
      assigned_at: assignment.created_at,
      assignment_updated_at: assignment.updated_at,
    }))

    // Build hierarchy if requested
    let hierarchy = []
    if (includeHierarchy && folders.length > 0) {
      // Get all folders in hierarchy for proper context
      const { data: allUserFolders, error: hierarchyError } = await supabase
        .from('folders')
        .select('*')
        .eq('user_id', userId)
        .order('sort_order', { ascending: true })

      if (!hierarchyError && allUserFolders) {
        // Build hierarchy tree
        const buildHierarchy = (
          folders: any[],
          parentId?: string,
          level = 0
        ): any[] => {
          return folders
            .filter((folder) => folder.parent_id === parentId)
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((folder) => ({
              ...folder,
              level,
              children: buildHierarchy(folders, folder.id, level + 1),
            }))
        }

        hierarchy = buildHierarchy(allUserFolders)
      }
    }

    const response: FileFoldersResponse = {
      folders,
      total: folders.length,
      file_id: fileId,
    }

    // Include hierarchy in response if requested and available
    if (includeHierarchy && hierarchy.length > 0) {
      ;(response as any).hierarchy = hierarchy
    }

    logger.info(
      'File folders retrieved successfully',
      'api/file-folders/[file-id]/folders',
      {
        userId,
        fileId,
        folderCount: folders.length,
        includeHierarchy,
      }
    )

    return NextResponse.json(response)
  } catch (error) {
    logger.error(
      'Unexpected error in file folders API',
      'api/file-folders/[file-id]/folders',
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        fileId: params['file-id'],
      }
    )

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
