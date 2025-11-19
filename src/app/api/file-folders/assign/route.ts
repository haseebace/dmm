/**
 * POST /api/file-folders/assign
 * DELETE /api/file-folders/assign
 *
 * File-Folder Assignment API endpoints
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import {
  BulkAssignmentSchema,
  AssignmentApiResponse,
} from '@/types/file-folders'

/**
 * POST /api/file-folders/assign
 *
 * Assign files to folders (supports bulk operations)
 *
 * Headers:
 * - X-User-ID: User ID (required)
 *
 * Body:
 * - assignments: Array of file-folder assignments
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
    const validation = BulkAssignmentSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: validation.error.issues,
        },
        { status: 400 }
      )
    }

    const { assignments } = validation.data

    const supabase = createServerClient()

    // Prepare assignments with user_id
    const assignmentsWithUser = assignments.map((assignment) => ({
      ...assignment,
      user_id: userId,
    }))

    // Check for duplicate assignments and file/folder existence
    const { data: existingAssignments, error: checkError } = await supabase
      .from('file_folders')
      .select('file_id, folder_id')
      .eq('user_id', userId)
      .or(
        assignments
          .map(
            (a) => `and(file_id.eq.${a.file_id},folder_id.eq.${a.folder_id})`
          )
          .join(',')
      )

    if (checkError) {
      logger.error(
        'Failed to check for existing assignments',
        'api/file-folders/assign',
        {
          userId,
          assignments,
          error: checkError.message,
        }
      )
      return NextResponse.json(
        { error: 'Failed to validate assignments' },
        { status: 500 }
      )
    }

    const existingKeys = new Set(
      existingAssignments?.map((a) => `${a.file_id}-${a.folder_id}`) || []
    )
    const newAssignments = assignmentsWithUser.filter(
      (assignment) =>
        !existingKeys.has(`${assignment.file_id}-${assignment.folder_id}`)
    )

    if (newAssignments.length === 0) {
      const response: AssignmentApiResponse = {
        success: true,
        data: [],
        message: 'All files are already assigned to the specified folders',
      }
      return NextResponse.json(response)
    }

    // Perform bulk assignment
    const { data: createdAssignments, error } = await supabase
      .from('file_folders')
      .insert(newAssignments)
      .select()

    if (error) {
      logger.error('Failed to create assignments', 'api/file-folders/assign', {
        userId,
        assignments,
        error: error.message,
      })
      return NextResponse.json(
        { error: 'Failed to assign files to folders' },
        { status: 500 }
      )
    }

    const response: AssignmentApiResponse = {
      success: true,
      data: createdAssignments || [],
      message: `Successfully assigned ${newAssignments.length} file(s) to folders`,
    }

    logger.info(
      'Files assigned to folders successfully',
      'api/file-folders/assign',
      {
        userId,
        assignmentsCount: newAssignments.length,
        duplicatesSkipped: assignments.length - newAssignments.length,
      }
    )

    return NextResponse.json(response, { status: 201 })
  } catch (error) {
    logger.error(
      'Unexpected error in assignment creation',
      'api/file-folders/assign',
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

/**
 * DELETE /api/file-folders/assign
 *
 * Remove files from folders (supports bulk operations)
 *
 * Headers:
 * - X-User-ID: User ID (required)
 *
 * Body:
 * - assignments: Array of file-folder assignments to remove
 */
export async function DELETE(request: NextRequest) {
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
    const validation = BulkAssignmentSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: validation.error.issues,
        },
        { status: 400 }
      )
    }

    const { assignments } = validation.data

    const supabase = createServerClient()

    // Delete assignments with user_id filter for security
    const deleteConditions = assignments.map(
      (assignment) =>
        `and(file_id.eq.${assignment.file_id},folder_id.eq.${assignment.folder_id})`
    )

    const { error } = await supabase
      .from('file_folders')
      .delete()
      .eq('user_id', userId)
      .or(deleteConditions.join(','))

    if (error) {
      logger.error('Failed to remove assignments', 'api/file-folders/assign', {
        userId,
        assignments,
        error: error.message,
      })
      return NextResponse.json(
        { error: 'Failed to remove files from folders' },
        { status: 500 }
      )
    }

    const response: AssignmentApiResponse = {
      success: true,
      data: [],
      message: `Successfully removed ${assignments.length} file(s) from folders`,
    }

    logger.info(
      'Files removed from folders successfully',
      'api/file-folders/assign',
      {
        userId,
        assignmentsCount: assignments.length,
      }
    )

    return NextResponse.json(response)
  } catch (error) {
    logger.error(
      'Unexpected error in assignment removal',
      'api/file-folders/assign',
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
