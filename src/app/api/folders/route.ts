/**
 * GET /api/folders
 * POST /api/folders
 *
 * Folder CRUD API endpoints
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import {
  CreateFolderSchema,
  FolderApiResponse,
  FolderListResponse,
} from '@/types/folders'

/**
 * GET /api/folders
 *
 * Get all folders for a user with optional hierarchy support
 *
 * Query parameters:
 * - userId: User ID (required)
 * - parentId: Filter by parent folder ID (optional)
 * - includeHierarchy: Include hierarchical structure (optional, default: true)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const parentId = searchParams.get('parentId')
    const includeHierarchy = searchParams.get('includeHierarchy') !== 'false'

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    const supabase = createServerClient()

    let query = supabase
      .from('folders')
      .select('*')
      .eq('user_id', userId)
      .order('sort_order', { ascending: true })

    if (parentId) {
      query = query.eq('parent_id', parentId)
    }

    const { data: folders, error } = await query

    if (error) {
      logger.error('Failed to fetch folders', 'api/folders', {
        userId,
        parentId,
        error: error.message,
      })
      return NextResponse.json(
        { error: 'Failed to fetch folders' },
        { status: 500 }
      )
    }

    let hierarchy = []
    if (includeHierarchy && folders) {
      // Build hierarchy structure
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

      hierarchy = buildHierarchy(folders)
    }

    const response: FolderListResponse = {
      folders: folders || [],
      hierarchy,
      total: folders?.length || 0,
    }

    logger.info('Folders retrieved successfully', 'api/folders', {
      userId,
      parentId,
      folderCount: folders?.length || 0,
      includeHierarchy,
    })

    return NextResponse.json(response)
  } catch (error) {
    logger.error('Unexpected error in folders API', 'api/folders', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    })

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/folders
 *
 * Create a new folder
 *
 * Headers:
 * - X-User-ID: User ID (required)
 *
 * Body:
 * - name: string (required)
 * - parentId?: string
 * - description?: string
 * - color?: string (hex color)
 */
export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('X-User-ID')

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 401 }
      )
    }

    const body = await request.json()

    // Validate request body
    const validation = CreateFolderSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: validation.error.issues,
        },
        { status: 400 }
      )
    }

    const { name, parentId, description, color } = validation.data

    const supabase = createServerClient()

    // Check for duplicate folder names in the same parent
    const { data: existingFolder, error: checkError } = await supabase
      .from('folders')
      .select('id')
      .eq('user_id', userId)
      .eq('parent_id', parentId || null)
      .ilike('name', name)
      .single()

    if (checkError && checkError.code !== 'PGRST116') {
      // Not found error
      logger.error('Failed to check for duplicate folder', 'api/folders', {
        userId,
        parentId,
        name,
        error: checkError.message,
      })
      return NextResponse.json(
        { error: 'Failed to validate folder name' },
        { status: 500 }
      )
    }

    if (existingFolder) {
      return NextResponse.json(
        { error: 'A folder with this name already exists in this location' },
        { status: 409 }
      )
    }

    // Get the next sort order for the parent
    const { data: maxSortFolder, error: sortError } = await supabase
      .from('folders')
      .select('sort_order')
      .eq('user_id', userId)
      .eq('parent_id', parentId || null)
      .order('sort_order', { ascending: false })
      .limit(1)
      .single()

    const sortOrder = maxSortFolder?.sort_order
      ? maxSortFolder.sort_order + 1
      : 0

    // Create the folder
    const { data: folder, error } = await supabase
      .from('folders')
      .insert({
        user_id: userId,
        name,
        parent_id: parentId || null,
        description,
        color,
        sort_order: sortOrder,
      })
      .select()
      .single()

    if (error) {
      logger.error('Failed to create folder', 'api/folders', {
        userId,
        name,
        parentId,
        error: error.message,
      })
      return NextResponse.json(
        { error: 'Failed to create folder' },
        { status: 500 }
      )
    }

    const response: FolderApiResponse = {
      success: true,
      data: folder,
      message: 'Folder created successfully',
    }

    logger.info('Folder created successfully', 'api/folders', {
      userId,
      folderId: folder.id,
      folderName: folder.name,
      parentId,
    })

    return NextResponse.json(response, { status: 201 })
  } catch (error) {
    logger.error('Unexpected error in folder creation', 'api/folders', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    })

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
