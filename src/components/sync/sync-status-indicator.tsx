/**
 * Sync Status Indicator Component
 *
 * Displays real-time synchronization status and provides controls
 */

'use client'

import { useRealtimeSync } from '@/hooks/use-realtime-sync'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { AlertCircle, CheckCircle, Clock, RefreshCw, X } from 'lucide-react'

export function SyncStatusIndicator() {
  const {
    isConnected,
    currentOperation,
    conflicts,
    recentUpdates,
    error,
    resolveConflict,
    refreshMetadata,
    clearConflicts,
    clearRecentUpdates,
  } = useRealtimeSync()

  const formatDuration = (startTime: string) => {
    const start = new Date(startTime)
    const now = new Date()
    const duration = Math.floor((now.getTime() - start.getTime()) / 1000)

    if (duration < 60) return `${duration}s`
    if (duration < 3600)
      return `${Math.floor(duration / 60)}m ${duration % 60}s`
    return `${Math.floor(duration / 3600)}h ${Math.floor((duration % 3600) / 60)}m`
  }

  const getProgressPercentage = () => {
    if (!currentOperation) return 0
    if (currentOperation.items_total === 0) return 0
    return Math.round(
      (currentOperation.items_processed / currentOperation.items_total) * 100
    )
  }

  return (
    <div className="space-y-4">
      {/* Connection Status */}
      <div className="flex items-center gap-2">
        <div
          className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}
        />
        <span className="text-muted-foreground text-sm">
          {isConnected
            ? 'Connected to real-time updates'
            : 'Disconnected from real-time updates'}
        </span>
      </div>

      {/* Error Display */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-800">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{error.message}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Current Sync Operation */}
      {currentOperation && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                Synchronization in Progress
              </CardTitle>
              <Badge
                variant={
                  currentOperation.status === 'running'
                    ? 'default'
                    : 'secondary'
                }
              >
                {currentOperation.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span>Progress</span>
              <span>
                {currentOperation.items_processed} /{' '}
                {currentOperation.items_total}
              </span>
            </div>
            <Progress value={getProgressPercentage()} className="w-full" />
            <div className="text-muted-foreground flex items-center justify-between text-sm">
              <span>Started</span>
              <span>{formatDuration(currentOperation.started_at)}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sync Controls */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Sync Controls</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            onClick={refreshMetadata}
            disabled={!isConnected || !!currentOperation}
            className="w-full"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Start Manual Sync
          </Button>
        </CardContent>
      </Card>

      {/* Conflicts */}
      {conflicts.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                Sync Conflicts ({conflicts.length})
              </CardTitle>
              <Button variant="outline" size="sm" onClick={clearConflicts}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {conflicts.slice(0, 3).map((conflict) => (
              <div
                key={conflict.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-yellow-500" />
                    <span className="text-sm font-medium">
                      {conflict.conflict_type}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {conflict.resolution_status === 'pending'
                      ? 'Resolution needed'
                      : 'Resolved'}
                  </p>
                </div>
                {conflict.resolution_status === 'pending' && (
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => resolveConflict(conflict.id, 'keep_local')}
                    >
                      Keep Local
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        resolveConflict(conflict.id, 'keep_remote')
                      }
                    >
                      Keep Remote
                    </Button>
                  </div>
                )}
              </div>
            ))}
            {conflicts.length > 3 && (
              <p className="text-muted-foreground text-center text-sm">
                And {conflicts.length - 3} more conflicts...
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recent Updates */}
      {recentUpdates.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                Recent Updates ({recentUpdates.length})
              </CardTitle>
              <Button variant="outline" size="sm" onClick={clearRecentUpdates}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentUpdates.slice(0, 5).map((update) => (
              <div key={update.id} className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="flex-1 truncate">{update.name}</span>
                <Badge variant="outline" className="text-xs">
                  {update.type}
                </Badge>
              </div>
            ))}
            {recentUpdates.length > 5 && (
              <p className="text-muted-foreground text-center text-sm">
                And {recentUpdates.length - 5} more updates...
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* No Activity State */}
      {!currentOperation &&
        conflicts.length === 0 &&
        recentUpdates.length === 0 && (
          <Card>
            <CardContent className="pt-6 text-center">
              <Clock className="text-muted-foreground mx-auto mb-2 h-8 w-8" />
              <p className="text-muted-foreground text-sm">
                No recent sync activity
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                {isConnected
                  ? 'Ready to receive real-time updates'
                  : 'Connect to see real-time updates'}
              </p>
            </CardContent>
          </Card>
        )}
    </div>
  )
}
