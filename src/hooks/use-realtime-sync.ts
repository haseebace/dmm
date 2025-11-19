/**
 * Real-time Sync Hook
 *
 * React hook for consuming real-time synchronization updates
 */

import { useEffect, useCallback, useRef, useState } from 'react'
import {
  realtimeService,
  type SubscriptionCallbacks,
} from '@/lib/realtime/service'
import { useAuth } from '@/hooks/use-auth'
import type {
  SyncOperation,
  SyncConflict,
  FileMetadata,
} from '@/types/metadata'

export interface RealtimeSyncState {
  isConnected: boolean
  currentOperation: SyncOperation | null
  conflicts: SyncConflict[]
  recentUpdates: FileMetadata[]
  error: Error | null
}

export interface UseRealtimeSyncOptions {
  onSyncStart?: (operation: SyncOperation) => void
  onSyncProgress?: (operation: SyncOperation) => void
  onSyncComplete?: (operation: SyncOperation) => void
  onConflictDetected?: (conflict: SyncConflict) => void
  onMetadataUpdate?: (metadata: FileMetadata) => void
  onError?: (error: Error) => void
}

export function useRealtimeSync(options: UseRealtimeSyncOptions = {}) {
  const { user } = useAuth()
  const subscriptions = useRef<string[]>([])
  const [state, setState] = useState<RealtimeSyncState>({
    isConnected: false,
    currentOperation: null,
    conflicts: [],
    recentUpdates: [],
    error: null,
  })

  const handleError = useCallback(
    (error: Error) => {
      setState((prev) => ({ ...prev, error }))
      options.onError?.(error)
    },
    [options.onError]
  )

  const handleSyncStart = useCallback(
    (payload: any) => {
      const operation = payload.new as SyncOperation
      setState((prev) => ({
        ...prev,
        currentOperation: operation,
        error: null,
      }))
      options.onSyncStart?.(operation)
    },
    [options.onSyncStart]
  )

  const handleSyncProgress = useCallback(
    (payload: any) => {
      const operation = payload.new as SyncOperation
      setState((prev) => ({
        ...prev,
        currentOperation: operation,
      }))
      options.onSyncProgress?.(operation)
    },
    [options.onSyncProgress]
  )

  const handleSyncComplete = useCallback(
    (payload: any) => {
      const operation = payload.new as SyncOperation
      setState((prev) => ({
        ...prev,
        currentOperation: operation.status === 'completed' ? null : operation,
      }))
      options.onSyncComplete?.(operation)
    },
    [options.onSyncComplete]
  )

  const handleConflictDetected = useCallback(
    (payload: any) => {
      const conflict = payload.new as SyncConflict
      setState((prev) => ({
        ...prev,
        conflicts: [...prev.conflicts, conflict],
      }))
      options.onConflictDetected?.(conflict)
    },
    [options.onConflictDetected]
  )

  const handleMetadataUpdate = useCallback(
    (payload: any) => {
      const metadata = payload.new as FileMetadata

      setState((prev) => {
        const existingIndex = prev.recentUpdates.findIndex(
          (update) => update.id === metadata.id
        )
        const newUpdates = [...prev.recentUpdates]

        if (existingIndex >= 0) {
          newUpdates[existingIndex] = metadata
        } else {
          newUpdates.unshift(metadata)
          // Keep only the 50 most recent updates
          if (newUpdates.length > 50) {
            newUpdates.pop()
          }
        }

        return { ...prev, recentUpdates: newUpdates }
      })

      options.onMetadataUpdate?.(metadata)
    },
    [options.onMetadataUpdate]
  )

  // Subscribe to real-time updates when user changes
  useEffect(() => {
    if (!user?.id) {
      // Cleanup when user logs out
      subscriptions.current.forEach((subscription) => {
        realtimeService.unsubscribe(subscription)
      })
      subscriptions.current = []
      setState({
        isConnected: false,
        currentOperation: null,
        conflicts: [],
        recentUpdates: [],
        error: null,
      })
      return
    }

    // Set user ID and subscribe
    realtimeService.setUserId(user.id)

    const callbacks: SubscriptionCallbacks = {
      onSyncStart: handleSyncStart,
      onSyncProgress: handleSyncProgress,
      onSyncComplete: handleSyncComplete,
      onConflictDetected: handleConflictDetected,
      onMetadataUpdate: handleMetadataUpdate,
      onError: handleError,
    }

    try {
      const newSubscriptions = realtimeService.subscribeToAllUpdates(callbacks)
      subscriptions.current = newSubscriptions

      setState((prev) => ({ ...prev, isConnected: true, error: null }))
    } catch (error) {
      handleError(
        error instanceof Error
          ? error
          : new Error('Failed to subscribe to real-time updates')
      )
    }

    // Cleanup on unmount or user change
    return () => {
      subscriptions.current.forEach((subscription) => {
        realtimeService.unsubscribe(subscription)
      })
      subscriptions.current = []
    }
  }, [
    user?.id,
    handleSyncStart,
    handleSyncProgress,
    handleSyncComplete,
    handleConflictDetected,
    handleMetadataUpdate,
    handleError,
  ])

  // Manual conflict resolution
  const resolveConflict = useCallback(
    async (
      conflictId: string,
      resolution: 'keep_local' | 'keep_remote' | 'merge'
    ) => {
      try {
        const response = await fetch('/api/metadata/conflicts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            conflict_id: conflictId,
            resolution,
          }),
        })

        if (!response.ok) {
          throw new Error(`Failed to resolve conflict: ${response.statusText}`)
        }

        const result = await response.json()

        // Remove resolved conflict from state
        setState((prev) => ({
          ...prev,
          conflicts: prev.conflicts.filter(
            (conflict) => conflict.id !== conflictId
          ),
        }))

        return result
      } catch (error) {
        const err =
          error instanceof Error
            ? error
            : new Error('Failed to resolve conflict')
        handleError(err)
        throw err
      }
    },
    [handleError]
  )

  // Manual refresh of metadata
  const refreshMetadata = useCallback(async () => {
    try {
      const response = await fetch('/api/metadata/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          operation_type: 'incremental_sync',
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to start sync: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      const err =
        error instanceof Error ? error : new Error('Failed to start sync')
      handleError(err)
      throw err
    }
  }, [handleError])

  // Clear conflicts
  const clearConflicts = useCallback(() => {
    setState((prev) => ({ ...prev, conflicts: [] }))
  }, [])

  // Clear recent updates
  const clearRecentUpdates = useCallback(() => {
    setState((prev) => ({ ...prev, recentUpdates: [] }))
  }, [])

  return {
    ...state,
    resolveConflict,
    refreshMetadata,
    clearConflicts,
    clearRecentUpdates,
  }
}
