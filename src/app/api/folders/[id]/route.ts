/**
 * GET /api/folders/[id]
 * PUT /api/folders/[id]
 * DELETE /api/folders/[id]
 *
 * Individual folder operations
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import {
  UpdateFolderSchema,
  DeleteFolderSchema,
  FolderApiResponse,
} from '@/types/folders'

/**
 * GET /api/folders/[id]
 *
 * Get a specific folder by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    const supabase = createServerClient()

    const { data: folder, error } = await supabase
      .from('folders')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId) // Ensure user can only access their own folders
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // Not found
        return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
      }

      logger.error('Failed to fetch folder', 'api/folders/[id]', {
        folderId: id,
        userId,
        error: error.message,
      })
      return NextResponse.json(
        { error: 'Failed to fetch folder' },
        { status: 500 }
      )
    }

    logger.info('Folder retrieved successfully', 'api/folders/[id]', {
      folderId: id,
      userId,
    })

    return NextResponse.json({ folder })
  } catch (error) {
    const { id } = await params
    logger.error('Unexpected error in folder retrieval', 'api/folders/[id]', {
      folderId: id,
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
 * PUT /api/folders/[id]
 *
 * Update a folder
 *
 * Body:
 * - name?: string
 * - parentId?: string
 * - description?: string
 * - color?: string
 * - sortOrder?: number
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    // Validate request body
    const validation = UpdateFolderSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: validation.error.issues,
        },
        { status: 400 }
      )
    }

    const updates = validation.data

    const supabase = createServerClient()

    // First check if folder exists and get user_id
    const { data: existingFolder, error: fetchError } = await supabase
      .from('folders')
      .select('user_id, parent_id, name')
      .eq('id', id)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        // Not found
        return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
      }

      logger.error('Failed to fetch folder for update', 'api/folders/[id]', {
        folderId: id,
        error: fetchError.message,
      })
      return NextResponse.json(
        { error: 'Failed to fetch folder' },
        { status: 500 }
      )
    }

    // Check for duplicate folder names if name is being updated
    if (updates.name && updates.name !== existingFolder.name) {
      const { data: duplicateFolder, error: checkError } = await supabase
        .from('folders')
        .select('id')
        .eq('user_id', existingFolder.user_id)
        .eq('parent_id', updates.parentId || existingFolder.parent_id)
        .ilike('name', updates.name)
        .neq('id', id)
        .single()

      if (checkError && checkError.code !== 'PGRST116') {
        // Not found error
        logger.error(
          'Failed to check for duplicate folder name',
          'api/folders/[id]',
          {
            folderId: id,
            error: checkError.message,
          }
        )
        return NextResponse.json(
          { error: 'Failed to validate folder name' },
          { status: 500 }
        )
      }

      if (duplicateFolder) {
        return NextResponse.json(
          { error: 'A folder with this name already exists in this location' },
          { status: 409 }
        )
      }
    }

    // Prevent circular references if parentId is being updated
    if (updates.parentId) {
      const { data: childFolder, error: circularCheckError } = await supabase
        .from('folders')
        .select('id')
        .eq('id', updates.parentId)
        .eq('parent_id', id)
        .single()

      if (circularCheckError && circularCheckError.code !== 'PGRST116') {
        logger.error(
          'Failed to check for circular reference',
          'api/folders/[id]',
          {
            folderId: id,
            newParentId: updates.parentId,
            error: circularCheckError.message,
          }
        )
        return NextResponse.json(
          { error: 'Failed to validate folder move' },
          { status: 500 }
        )
      }

      if (childFolder) {
        return NextResponse.json(
          { error: 'Cannot move a folder into its own subfolder' },
          { status: 400 }
        )
      }
    }

    // Update the folder
    const { data: folder, error } = await supabase
      .from('folders')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      logger.error('Failed to update folder', 'api/folders/[id]', {
        folderId: id,
        updates,
        error: error.message,
      })
      return NextResponse.json(
        { error: 'Failed to update folder' },
        { status: 500 }
      )
    }

    const response: FolderApiResponse = {
      success: true,
      data: folder,
      message: 'Folder updated successfully',
    }

    logger.info('Folder updated successfully', 'api/folders/[id]', {
      folderId: id,
      updates,
    })

    return NextResponse.json(response)
  } catch (error) {
    const { id } = await params
    logger.error('Unexpected error in folder update', 'api/folders/[id]', {
      folderId: id,
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
 * DELETE /api/folders/[id]
 *
 * Delete a folder
 *
 * Query parameters:
 * - force: boolean (default: false) - Delete even if contains items
 * - moveToParent: boolean (default: false) - Move contents to parent folder before deletion
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const force = searchParams.get('force') === 'true'
    const moveToParent = searchParams.get('moveToParent') === 'true'

    // Validate query parameters
    const validation = DeleteFolderSchema.safeParse({ force, moveToParent })
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid query parameters',
          details: validation.error.issues,
        },
        { status: 400 }
      )
    }

    const supabase = createServerClient()

    // First check if folder exists and get user_id
    const { data: existingFolder, error: fetchError } = await supabase
      .from('folders')
      .select('user_id, parent_id, name')
      .eq('id', id)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        // Not found
        return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
      }

      logger.error('Failed to fetch folder for deletion', 'api/folders/[id]', {
        folderId: id,
        error: fetchError.message,
      })
      return NextResponse.json(
        { error: 'Failed to fetch folder' },
        { status: 500 }
      )
    }

    // Check if folder has contents
    const { data: subfolders, error: subfolderError } = await supabase
      .from('folders')
      .select('id')
      .eq('parent_id', id)

    // Check for files in this folder (assuming file_folders table exists)
    const { data: files, error: fileError } = await supabase
      .from('file_folders')
      .select('file_id')
      .eq('folder_id', id)
      .limit(1)

    const hasContents =
      (subfolders && subfolders.length > 0) || (files && files.length > 0)

    if (hasContents && !force) {
      const itemCount = (subfolders?.length || 0) + (files?.length || 0)
      return NextResponse.json(
        {
          error: `Folder contains ${itemCount} item(s). Use force=true to delete.`,
          hasContents: true,
          itemCount,
        },
        { status: 409 }
      )
    }

    let affectedItems = 0

    if (hasContents && force && moveToParent && existingFolder.parent_id) {
      // Move contents to parent folder
      if (subfolders && subfolders.length > 0) {
        const { error: moveError } = await supabase
          .from('folders')
          .update({ parent_id: existingFolder.parent_id })
          .eq('parent_id', id)

        if (moveError) {
          logger.error(
            'Failed to move subfolders to parent',
            'api/folders/[id]',
            {
              folderId: id,
              error: moveError.message,
            }
          )
          return NextResponse.json(
            { error: 'Failed to move subfolders' },
            { status: 500 }
          )
        }
        affectedItems += subfolders.length
      }

      if (files && files.length > 0) {
        const { error: moveFilesError } = await supabase
          .from('file_folders')
          .update({ folder_id: existingFolder.parent_id })
          .eq('folder_id', id)

        if (moveFilesError) {
          logger.error('Failed to move files to parent', 'api/folders/[id]', {
            folderId: id,
            error: moveFilesError.message,
          })
          return NextResponse.json(
            { error: 'Failed to move files' },
            { status: 500 }
          )
        }
        affectedItems += files.length
      }
    }

    // Delete the folder (cascade delete will handle subfolders if not moved)
    const { error } = await supabase.from('folders').delete().eq('id', id)

    if (error) {
      logger.error('Failed to delete folder', 'api/folders/[id]', {
        folderId: id,
        force,
        moveToParent,
        error: error.message,
      })
      return NextResponse.json(
        { error: 'Failed to delete folder' },
        { status: 500 }
      )
    }

    const response: FolderApiResponse = {
      success: true,
      message: 'Folder deleted successfully',
    }

    if (affectedItems > 0) {
      response.data = { affectedItems }
    }

    logger.info('Folder deleted successfully', 'api/folders/[id]', {
      folderId: id,
      folderName: existingFolder.name,
      force,
      moveToParent,
      affectedItems,
    })

    return NextResponse.json(response)
  } catch (error) {
    const { id } = await params
    logger.error('Unexpected error in folder deletion', 'api/folders/[id]', {
      folderId: id,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    })

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
