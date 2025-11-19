/**
 * File Folders API Client
 *
 * Client functions for file-folder assignment API endpoints
 */

import {
  AssignmentOperation,
  AssignmentResult,
  BulkAssignmentResult,
} from '@/types/file-folders'

/**
 * Assign files to folders
 */
export async function assignFilesToFolders(
  operations: AssignmentOperation[]
): Promise<BulkAssignmentResult> {
  try {
    const response = await fetch('/api/file-folders/assign', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-ID': 'current-user', // TODO: Get from auth context
      },
      body: JSON.stringify({
        assignments: operations,
      }),
    })

    if (!response.ok) {
      throw new Error(`Assignment failed: ${response.statusText}`)
    }

    const data = await response.json()

    if (data.success) {
      return {
        successful: (data.data || []).map((assignment: any) => ({
          success: true,
          assignment,
        })),
        failed: [],
        total: operations.length,
      }
    } else {
      return {
        successful: [],
        failed: operations.map((op) => ({
          success: false,
          error: data.error || 'Assignment failed',
          assignment: op,
        })),
        total: operations.length,
      }
    }
  } catch (error) {
    return {
      successful: [],
      failed: operations.map((op) => ({
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
        assignment: op,
      })),
      total: operations.length,
    }
  }
}

/**
 * Remove files from folders
 */
export async function removeFilesFromFolders(
  operations: AssignmentOperation[]
): Promise<BulkAssignmentResult> {
  try {
    const response = await fetch('/api/file-folders/assign', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'X-User-ID': 'current-user', // TODO: Get from auth context
      },
      body: JSON.stringify({
        assignments: operations,
      }),
    })

    if (!response.ok) {
      throw new Error(`Removal failed: ${response.statusText}`)
    }

    const data = await response.json()

    if (data.success) {
      return {
        successful: operations.map((op) => ({
          success: true,
          assignment: op,
        })),
        failed: [],
        total: operations.length,
      }
    } else {
      return {
        successful: [],
        failed: operations.map((op) => ({
          success: false,
          error: data.error || 'Removal failed',
          assignment: op,
        })),
        total: operations.length,
      }
    }
  } catch (error) {
    return {
      successful: [],
      failed: operations.map((op) => ({
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
        assignment: op,
      })),
      total: operations.length,
    }
  }
}

/**
 * Get files in folder
 */
export async function getFolderFiles(
  folderId: string,
  options?: {
    page?: number
    limit?: number
    sort?: string
    order?: 'asc' | 'desc'
    search?: string
  }
) {
  const params = new URLSearchParams({
    userId: 'current-user', // TODO: Get from auth context
    page: (options?.page || 1).toString(),
    limit: (options?.limit || 50).toString(),
    sort: options?.sort || 'created_at',
    order: options?.order || 'desc',
  })

  if (options?.search) {
    params.set('search', options.search)
  }

  const response = await fetch(`/api/file-folders/${folderId}/files?${params}`)

  if (!response.ok) {
    throw new Error(`Failed to fetch folder files: ${response.statusText}`)
  }

  return response.json()
}

/**
 * Get folders for file
 */
export async function getFileFolders(fileId: string) {
  const params = new URLSearchParams({
    userId: 'current-user', // TODO: Get from auth context
    includeHierarchy: 'true',
  })

  const response = await fetch(`/api/file-folders/${fileId}/folders?${params}`)

  if (!response.ok) {
    throw new Error(`Failed to fetch file folders: ${response.statusText}`)
  }

  return response.json()
}

/**
 * Update virtual filename
 */
export async function updateAssignmentVirtualFilename(
  assignmentId: string,
  virtualFilename: string
): Promise<void> {
  // This endpoint doesn't exist yet - would need to be implemented
  throw new Error('Virtual filename update not yet implemented')
}
