/**
 * Connection Notifications
 *
 * Component for displaying connection status notifications
 * with toast-style notifications, actions, and dismissal.
 */

'use client'

import React, { useEffect } from 'react'
import {
  useConnectionNotifications,
  useConnectionActions,
} from '@/stores/connection-status'
import { ConnectionNotification } from '@/types/connection'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  X,
  Check,
  AlertCircle,
  CheckCircle,
  Info,
  AlertTriangle,
  RefreshCw,
  Settings,
  ExternalLink,
} from 'lucide-react'

interface ConnectionNotificationsProps {
  className?: string
  maxVisible?: number
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
  autoHide?: boolean
  autoHideDelay?: number
}

// Notification icon mapping
const NOTIFICATION_ICONS = {
  success: CheckCircle,
  warning: AlertTriangle,
  error: AlertCircle,
  info: Info,
}

// Notification color mapping
const NOTIFICATION_COLORS = {
  success:
    'border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-200',
  warning:
    'border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200',
  error:
    'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200',
  info: 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-200',
}

// Position classes
const POSITION_CLASSES = {
  'top-right': 'top-4 right-4',
  'top-left': 'top-4 left-4',
  'bottom-right': 'bottom-4 right-4',
  'bottom-left': 'bottom-4 left-4',
}

export function ConnectionNotifications({
  className = '',
  maxVisible = 5,
  position = 'top-right',
  autoHide = true,
  autoHideDelay = 8000,
}: ConnectionNotificationsProps) {
  const notifications = useConnectionNotifications()
  const { dismissNotification, acknowledgeNotification } =
    useConnectionActions()

  // Filter visible notifications
  const visibleNotifications = notifications
    .filter((n) => !n.dismissed)
    .slice(0, maxVisible)

  // Auto-hide notifications
  useEffect(() => {
    if (!autoHide) return

    visibleNotifications.forEach((notification) => {
      const timer = setTimeout(() => {
        if (notification.autoDismiss !== false) {
          dismissNotification(notification.id)
        }
      }, autoHideDelay)

      return () => clearTimeout(timer)
    })
  }, [visibleNotifications, autoHide, autoHideDelay, dismissNotification])

  const handleNotificationAction = (
    notification: ConnectionNotification,
    action: any
  ) => {
    acknowledgeNotification(notification.id)

    // Dispatch custom event for action handling
    const event = new CustomEvent('connectionNotificationAction', {
      detail: {
        notificationId: notification.id,
        action: action.action,
        notification,
      },
    })

    window.dispatchEvent(event)

    // Dismiss if not explicitly prevented
    if (action.action !== 'dismiss') {
      dismissNotification(notification.id)
    }
  }

  if (visibleNotifications.length === 0) {
    return null
  }

  return (
    <div
      className={`fixed z-50 space-y-2 ${POSITION_CLASSES[position]} ${className}`}
      role="region"
      aria-label="Connection notifications"
      aria-live="polite"
    >
      {visibleNotifications.map((notification) => {
        const Icon = NOTIFICATION_ICONS[notification.type]
        const colorClass = NOTIFICATION_COLORS[notification.type]

        return (
          <div
            key={notification.id}
            className={`max-w-sm rounded-lg border p-4 shadow-lg transition-all duration-300 ease-in-out ${colorClass} ${notification.dismissible ? 'cursor-pointer' : ''} `}
            role="alert"
            aria-live={
              notification.severity === 'critical' ? 'assertive' : 'polite'
            }
          >
            <div className="flex items-start gap-3">
              {/* Icon */}
              <div className="mt-0.5 flex-shrink-0">
                <Icon className="h-5 w-5" />
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold">
                      {notification.title}
                    </h4>
                    <p className="mt-1 text-sm opacity-90">
                      {notification.message}
                    </p>
                  </div>

                  {/* Close button */}
                  {notification.dismissible && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 hover:bg-white/20"
                      onClick={() => dismissNotification(notification.id)}
                      aria-label="Dismiss notification"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>

                {/* Timestamp */}
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs opacity-75">
                    {formatRelativeTime(notification.timestamp)}
                  </span>
                  {notification.severity && (
                    <Badge variant="secondary" className="text-xs">
                      {notification.severity}
                    </Badge>
                  )}
                </div>

                {/* Actions */}
                {notification.actions && notification.actions.length > 0 && (
                  <div className="mt-3 flex gap-2">
                    {notification.actions.map((action) => (
                      <Button
                        key={action.id}
                        variant={action.primary ? 'default' : 'outline'}
                        size="sm"
                        className={`h-7 text-xs ${
                          action.destructive
                            ? 'bg-red-600 text-white hover:bg-red-700'
                            : ''
                        }`}
                        onClick={() =>
                          handleNotificationAction(notification, action)
                        }
                      >
                        {getActionIcon(action.action)}
                        {action.label}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// Helper function to format relative time
function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`
  if (seconds > 0) return `${seconds} second${seconds > 1 ? 's' : ''} ago`
  return 'Just now'
}

// Helper function to get action icon
function getActionIcon(action: string) {
  const iconProps = { className: 'h-3 w-3 mr-1' }

  switch (action) {
    case 'reconnect':
      return <RefreshCw {...iconProps} />
    case 'retry':
      return <RefreshCw {...iconProps} />
    case 'settings':
      return <Settings {...iconProps} />
    case 'support':
      return <ExternalLink {...iconProps} />
    case 'dismiss':
      return <X {...iconProps} />
    case 'acknowledge':
      return <Check {...iconProps} />
    default:
      return null
  }
}

export default ConnectionNotifications
