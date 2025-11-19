/**
 * Connection Status Indicator
 *
 * Visual component showing current Real-Debrid connection status
 * with color coding, tooltips, and quick actions.
 */

'use client'

import React, { useState, useCallback } from 'react'
import {
  useConnectionHealth,
  useConnectionActions,
} from '@/stores/connection-status'
import {
  ConnectionStatus,
  AuthenticationState,
  ServiceState,
  NetworkState,
} from '@/types/connection'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Wifi,
  WifiOff,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Settings,
  Activity,
  Loader2,
} from 'lucide-react'

interface ConnectionStatusIndicatorProps {
  className?: string
  showDetails?: boolean
  compact?: boolean
  onReconnect?: () => void
  onSettings?: () => void
  onDiagnostics?: () => void
}

// Status configuration
const STATUS_CONFIG = {
  connected: {
    icon: CheckCircle,
    color: 'text-green-500',
    bgColor: 'bg-green-100 dark:bg-green-900/20',
    label: 'Connected',
    description: 'Real-Debrid services are working normally',
  },
  connecting: {
    icon: Loader2,
    color: 'text-blue-500',
    bgColor: 'bg-blue-100 dark:bg-blue-900/20',
    label: 'Connecting',
    description: 'Establishing connection to Real-Debrid',
  },
  disconnected: {
    icon: WifiOff,
    color: 'text-red-500',
    bgColor: 'bg-red-100 dark:bg-red-900/20',
    label: 'Disconnected',
    description: 'No connection to Real-Debrid services',
  },
  error: {
    icon: XCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-100 dark:bg-red-900/20',
    label: 'Error',
    description: 'Connection error occurred',
  },
  limited: {
    icon: AlertTriangle,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/20',
    label: 'Limited',
    description: 'Connection has some limitations',
  },
  reconnecting: {
    icon: RefreshCw,
    color: 'text-blue-500',
    bgColor: 'bg-blue-100 dark:bg-blue-900/20',
    label: 'Reconnecting',
    description: 'Attempting to reconnect to Real-Debrid',
  },
}

// Component-specific status icons
const COMPONENT_ICONS = {
  authentication: {
    authenticated: CheckCircle,
    unauthenticated: XCircle,
    token_expired: AlertTriangle,
    error: XCircle,
  },
  service: {
    available: CheckCircle,
    degraded: AlertTriangle,
    unavailable: XCircle,
    rate_limited: AlertTriangle,
  },
  network: {
    connected: Wifi,
    disconnected: WifiOff,
    poor_connection: AlertTriangle,
  },
}

export function ConnectionStatusIndicator({
  className = '',
  showDetails = true,
  compact = false,
  onReconnect,
  onSettings,
  onDiagnostics,
}: ConnectionStatusIndicatorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const connectionHealth = useConnectionHealth()
  const { triggerManualReconnection } = useConnectionActions()

  const handleReconnect = useCallback(async () => {
    try {
      await triggerManualReconnection('manual')
      onReconnect?.()
    } catch (error) {
      console.error('Reconnection failed:', error)
    }
  }, [triggerManualReconnection, onReconnect])

  const getStatusConfig = (status?: ConnectionStatus) => {
    return STATUS_CONFIG[status || 'disconnected']
  }

  const formatResponseTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  const formatUptime = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) return `${days}d ${hours % 24}h`
    if (hours > 0) return `${hours}h ${minutes % 60}m`
    return `${minutes}m`
  }

  if (!connectionHealth) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Badge variant="outline" className="text-xs">
          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          Loading...
        </Badge>
      </div>
    )
  }

  const statusConfig = getStatusConfig(connectionHealth.overallStatus)
  const StatusIcon = statusConfig.icon

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={`flex cursor-pointer items-center gap-2 ${className}`}
            >
              <StatusIcon
                className={`h-4 w-4 ${statusConfig.color} ${
                  connectionHealth.overallStatus === 'reconnecting'
                    ? 'animate-spin'
                    : ''
                }`}
              />
              <span className="text-sm font-medium">{statusConfig.label}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{statusConfig.description}</p>
            {showDetails && (
              <div className="mt-2 space-y-1 text-xs">
                <div>Auth: {connectionHealth.authentication}</div>
                <div>Service: {connectionHealth.service}</div>
                <div>Network: {connectionHealth.network}</div>
                <div>
                  Response:{' '}
                  {formatResponseTime(connectionHealth.responseTime || 0)}
                </div>
              </div>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Main status indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`rounded-lg p-2 ${statusConfig.bgColor}`}>
            <StatusIcon
              className={`h-5 w-5 ${statusConfig.color} ${
                connectionHealth.overallStatus === 'reconnecting'
                  ? 'animate-spin'
                  : ''
              }`}
            />
          </div>
          <div>
            <h3 className="text-lg font-semibold">{statusConfig.label}</h3>
            <p className="text-muted-foreground text-sm">
              {statusConfig.description}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {connectionHealth.overallStatus === 'disconnected' ||
          connectionHealth.overallStatus === 'error' ? (
            <Button
              size="sm"
              onClick={handleReconnect}
              disabled={connectionHealth.overallStatus === 'reconnecting'}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Reconnect
            </Button>
          ) : null}

          <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Activity className="mr-2 h-4 w-4" />
                Details
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuItem asChild>
                <button
                  onClick={() => {
                    setIsOpen(false)
                    onDiagnostics?.()
                  }}
                  className="flex w-full items-center"
                >
                  <Activity className="mr-2 h-4 w-4" />
                  Run Diagnostics
                </button>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <button
                  onClick={() => {
                    setIsOpen(false)
                    onSettings?.()
                  }}
                  className="flex w-full items-center"
                >
                  <Settings className="mr-2 h-4 w-4" />
                  Connection Settings
                </button>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <button
                  onClick={() => {
                    setIsOpen(false)
                    handleReconnect()
                  }}
                  className="flex w-full items-center"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Manual Reconnect
                </button>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {showDetails && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Authentication Status */}
          <div className="rounded-lg border p-4">
            <div className="mb-2 flex items-center gap-2">
              {React.createElement(
                COMPONENT_ICONS.authentication[
                  connectionHealth.authentication as keyof typeof COMPONENT_ICONS.authentication
                ],
                { className: 'h-4 w-4' }
              )}
              <span className="text-sm font-medium">Authentication</span>
            </div>
            <p className="text-muted-foreground text-xs capitalize">
              {connectionHealth.authentication}
            </p>
            {connectionHealth.lastUpdated && (
              <p className="text-muted-foreground mt-1 text-xs">
                Updated {formatUptime(connectionHealth.lastUpdated)} ago
              </p>
            )}
          </div>

          {/* Service Status */}
          <div className="rounded-lg border p-4">
            <div className="mb-2 flex items-center gap-2">
              {React.createElement(
                COMPONENT_ICONS.service[
                  connectionHealth.service as keyof typeof COMPONENT_ICONS.service
                ],
                { className: 'h-4 w-4' }
              )}
              <span className="text-sm font-medium">Service</span>
            </div>
            <p className="text-muted-foreground text-xs capitalize">
              {connectionHealth.service}
            </p>
            {connectionHealth.responseTime && (
              <p className="text-muted-foreground mt-1 text-xs">
                Response: {formatResponseTime(connectionHealth.responseTime)}
              </p>
            )}
            {connectionHealth.consecutiveErrors > 0 && (
              <p className="mt-1 text-xs text-red-500">
                {connectionHealth.consecutiveErrors} consecutive errors
              </p>
            )}
          </div>

          {/* Network Status */}
          <div className="rounded-lg border p-4">
            <div className="mb-2 flex items-center gap-2">
              {React.createElement(
                COMPONENT_ICONS.network[
                  connectionHealth.network as keyof typeof COMPONENT_ICONS.network
                ],
                { className: 'h-4 w-4' }
              )}
              <span className="text-sm font-medium">Network</span>
            </div>
            <p className="text-muted-foreground text-xs capitalize">
              {connectionHealth.network}
            </p>
            {connectionHealth.lastUpdated && (
              <p className="text-muted-foreground mt-1 text-xs">
                Last check: {formatUptime(connectionHealth.lastUpdated)} ago
              </p>
            )}
          </div>
        </div>
      )}

      {/* Status history indicator */}
      {connectionHealth.consecutiveErrors > 3 && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-800 dark:bg-yellow-900/20">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
              Multiple consecutive errors detected
            </span>
          </div>
          <p className="mt-1 text-xs text-yellow-700 dark:text-yellow-300">
            Consider running diagnostics or checking your network connection.
          </p>
        </div>
      )}
    </div>
  )
}

export default ConnectionStatusIndicator
