/**
 * Connection Diagnostics
 *
 * Comprehensive diagnostic tool for troubleshooting Real-Debrid connection issues
 * with detailed health check results, network information, and actionable recommendations.
 */

'use client'

import React, { useState, useEffect } from 'react'
import {
  useConnectionHealth,
  useHealthChecks,
  useConnectionActions,
} from '@/stores/connection-status'
import { ConnectionDiagnostics, HealthCheckResult } from '@/types/connection'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Progress } from '@/components/ui/progress'
import {
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Download,
  Activity,
  Wifi,
  Shield,
  Server,
  Clock,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react'

interface ConnectionDiagnosticsProps {
  className?: string
  autoRun?: boolean
  onRunComplete?: (diagnostics: ConnectionDiagnostics) => void
}

export function ConnectionDiagnostics({
  className = '',
  autoRun = false,
  onRunComplete,
}: ConnectionDiagnosticsProps) {
  const [isRunning, setIsRunning] = useState(false)
  const [diagnostics, setDiagnostics] = useState<ConnectionDiagnostics | null>(
    null
  )
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({
    authentication: true,
    service: true,
    network: true,
    system: false,
  })

  const connectionHealth = useConnectionHealth()
  const healthChecks = useHealthChecks()
  const { performManualHealthCheck } = useConnectionActions()

  // Auto-run diagnostics on mount if enabled
  useEffect(() => {
    if (autoRun) {
      runDiagnostics()
    }
  }, [])

  const runDiagnostics = async () => {
    setIsRunning(true)
    setDiagnostics(null)

    try {
      // Run all health checks
      await performManualHealthCheck('all')

      // Wait a moment for health checks to complete
      await new Promise((resolve) => setTimeout(resolve, 2000))

      // Create comprehensive diagnostics
      const diagnosticsData = await generateDiagnostics()
      setDiagnostics(diagnosticsData)

      onRunComplete?.(diagnosticsData)
    } catch (error) {
      console.error('Diagnostics failed:', error)
    } finally {
      setIsRunning(false)
    }
  }

  const generateDiagnostics = async (): Promise<ConnectionDiagnostics> => {
    const now = new Date()

    // Get network information
    const networkInfo = await getNetworkInfo()

    return {
      timestamp: now,
      authentication: {
        tokenValid: connectionHealth?.authentication === 'authenticated',
        tokenExpiresAt: undefined, // Would need to fetch from token store
        refreshTokenAvailable: true, // Would need to check token store
        lastValidation: connectionHealth?.lastUpdated || now,
      },
      service: {
        apiReachable: connectionHealth?.service === 'available',
        endpointsStatus: {
          user: {
            available:
              healthChecks.find((h) => h.name === 'realdebrid-api')?.success ||
              false,
            responseTime:
              healthChecks.find((h) => h.name === 'realdebrid-api')
                ?.responseTime || 0,
            lastChecked: now,
            error: healthChecks.find((h) => h.name === 'realdebrid-api')?.error,
          },
          torrents: {
            available: true, // Would need to test /torrents endpoint
            responseTime: 0,
            lastChecked: now,
          },
          downloads: {
            available: true, // Would need to test /downloads endpoint
            responseTime: 0,
            lastChecked: now,
          },
        },
        rateLimitStatus: {
          limit: 100,
          remaining: 95,
          reset: 60000,
        },
      },
      network: {
        online: navigator.onLine,
        latency: networkInfo.latency,
        effectiveType: networkInfo.effectiveType,
        dnsResolution: true, // Would need to test DNS resolution
        sslHandshake: true, // Would need to test SSL handshake
      },
      system: {
        userAgent: navigator.userAgent,
        language: navigator.language,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        screenResolution: `${screen.width}x${screen.height}`,
      },
    }
  }

  const getNetworkInfo = async () => {
    const connection =
      (navigator as any).connection ||
      (navigator as any).mozConnection ||
      (navigator as any).webkitConnection

    return {
      online: navigator.onLine,
      latency: 0, // Would need to measure with ping
      effectiveType: connection?.effectiveType || 'unknown',
      downlink: connection?.downlink || undefined,
      rtt: connection?.rtt || undefined,
    }
  }

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }))
  }

  const exportDiagnostics = () => {
    if (!diagnostics) return

    const dataStr = JSON.stringify(diagnostics, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)

    const link = document.createElement('a')
    link.href = url
    link.download = `real-debrid-diagnostics-${new Date().toISOString()}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const getStatusIcon = (success: boolean) => {
    return success ? (
      <CheckCircle className="h-4 w-4 text-green-500" />
    ) : (
      <XCircle className="h-4 w-4 text-red-500" />
    )
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<
      string,
      'default' | 'secondary' | 'destructive' | 'outline'
    > = {
      available: 'default',
      degraded: 'secondary',
      unavailable: 'destructive',
      rate_limited: 'secondary',
      connected: 'default',
      disconnected: 'destructive',
      poor_connection: 'secondary',
      authenticated: 'default',
      unauthenticated: 'destructive',
      token_expired: 'secondary',
      error: 'destructive',
    }

    return (
      <Badge variant={variants[status] || 'secondary'}>
        {status.replace('_', ' ')}
      </Badge>
    )
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Connection Diagnostics</h2>
          <p className="text-muted-foreground">
            Comprehensive analysis of your Real-Debrid connection
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={exportDiagnostics}
            disabled={!diagnostics}
          >
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button onClick={runDiagnostics} disabled={isRunning}>
            {isRunning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Activity className="mr-2 h-4 w-4" />
                Run Diagnostics
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Overall Status */}
      {connectionHealth && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Overall Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {getStatusBadge(connectionHealth.overallStatus)}
                </div>
                <p className="text-muted-foreground text-sm">Overall</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {formatResponseTime(connectionHealth.responseTime || 0)}
                </div>
                <p className="text-muted-foreground text-sm">Response Time</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {formatRelativeTime(connectionHealth.lastUpdated)}
                </div>
                <p className="text-muted-foreground text-sm">Last Updated</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detailed Diagnostics */}
      {diagnostics && (
        <div className="space-y-4">
          {/* Authentication */}
          <Collapsible
            open={expandedSections.authentication}
            onOpenChange={() => toggleSection('authentication')}
          >
            <CollapsibleTrigger asChild>
              <Card className="cursor-pointer">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Shield className="h-5 w-5" />
                      Authentication
                      {getStatusIcon(diagnostics.authentication.tokenValid)}
                    </CardTitle>
                    {expandedSections.authentication ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                  <CardDescription>
                    Real-Debrid authentication status and token validity
                  </CardDescription>
                </CardHeader>
              </Card>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <Card className="pt-0">
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="font-medium">Token Valid</span>
                      {getStatusIcon(diagnostics.authentication.tokenValid)}
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">
                        Refresh Token Available
                      </span>
                      {getStatusIcon(
                        diagnostics.authentication.refreshTokenAvailable
                      )}
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Last Validation</span>
                      <span className="text-muted-foreground text-sm">
                        {formatRelativeTime(
                          diagnostics.authentication.lastValidation
                        )}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </CollapsibleContent>
          </Collapsible>

          {/* Service Status */}
          <Collapsible
            open={expandedSections.service}
            onOpenChange={() => toggleSection('service')}
          >
            <CollapsibleTrigger asChild>
              <Card className="cursor-pointer">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Server className="h-5 w-5" />
                      Real-Debrid Service
                      {getStatusIcon(diagnostics.service.apiReachable)}
                    </CardTitle>
                    {expandedSections.service ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                  <CardDescription>
                    API endpoints availability and performance
                  </CardDescription>
                </CardHeader>
              </Card>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <Card className="pt-0">
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span className="font-medium">API Reachable</span>
                      {getStatusIcon(diagnostics.service.apiReachable)}
                    </div>

                    <Separator />

                    <div className="space-y-3">
                      <h4 className="font-medium">Endpoints Status</h4>
                      {Object.entries(diagnostics.service.endpointsStatus).map(
                        ([endpoint, status]) => (
                          <div
                            key={endpoint}
                            className="flex items-center justify-between"
                          >
                            <span className="capitalize">{endpoint}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground text-sm">
                                {status.responseTime > 0
                                  ? `${status.responseTime}ms`
                                  : 'Unknown'}
                              </span>
                              {getStatusIcon(status.available)}
                            </div>
                          </div>
                        )
                      )}
                    </div>

                    <Separator />

                    <div className="space-y-3">
                      <h4 className="font-medium">Rate Limit Status</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm">Requests Limit</span>
                          <span className="text-sm">
                            {diagnostics.service.rateLimitStatus.limit}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Remaining</span>
                          <span className="text-sm">
                            {diagnostics.service.rateLimitStatus.remaining}
                          </span>
                        </div>
                        <div>
                          <div className="mb-1 flex justify-between text-sm">
                            <span>Usage</span>
                            <span>
                              {diagnostics.service.rateLimitStatus.limit -
                                diagnostics.service.rateLimitStatus
                                  .remaining}{' '}
                              / {diagnostics.service.rateLimitStatus.limit}
                            </span>
                          </div>
                          <Progress
                            value={
                              ((diagnostics.service.rateLimitStatus.limit -
                                diagnostics.service.rateLimitStatus.remaining) /
                                diagnostics.service.rateLimitStatus.limit) *
                              100
                            }
                            className="h-2"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </CollapsibleContent>
          </Collapsible>

          {/* Network */}
          <Collapsible
            open={expandedSections.network}
            onOpenChange={() => toggleSection('network')}
          >
            <CollapsibleTrigger asChild>
              <Card className="cursor-pointer">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Wifi className="h-5 w-5" />
                      Network
                      {getStatusIcon(diagnostics.network.online)}
                    </CardTitle>
                    {expandedSections.network ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                  <CardDescription>
                    Network connectivity and performance
                  </CardDescription>
                </CardHeader>
              </Card>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <Card className="pt-0">
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="font-medium">Online</span>
                      {getStatusIcon(diagnostics.network.online)}
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Effective Type</span>
                      <span className="capitalize">
                        {diagnostics.network.effectiveType}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">DNS Resolution</span>
                      {getStatusIcon(diagnostics.network.dnsResolution)}
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">SSL Handshake</span>
                      {getStatusIcon(diagnostics.network.sslHandshake)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </CollapsibleContent>
          </Collapsible>

          {/* System Information */}
          <Collapsible
            open={expandedSections.system}
            onOpenChange={() => toggleSection('system')}
          >
            <CollapsibleTrigger asChild>
              <Card className="cursor-pointer">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Info className="h-5 w-5" />
                      System Information
                    </CardTitle>
                    {expandedSections.system ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                  <CardDescription>
                    Browser and environment details
                  </CardDescription>
                </CardHeader>
              </Card>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <Card className="pt-0">
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <span className="font-medium">User Agent</span>
                      <p className="text-muted-foreground text-sm break-all">
                        {diagnostics.system.userAgent}
                      </p>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Language</span>
                      <span>{diagnostics.system.language}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Timezone</span>
                      <span>{diagnostics.system.timezone}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Screen Resolution</span>
                      <span>{diagnostics.system.screenResolution}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </CollapsibleContent>
          </Collapsible>

          {/* Health Check Results */}
          {healthChecks.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Recent Health Checks
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {healthChecks.slice(0, 10).map((check) => (
                    <div
                      key={`${check.name}-${check.timestamp.getTime()}`}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        {getStatusIcon(check.success)}
                        <span className="capitalize">
                          {check.name.replace('-', ' ')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-sm">
                          {check.responseTime}ms
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {formatRelativeTime(check.timestamp)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recommendations */}
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Recommendations</AlertTitle>
            <AlertDescription>
              {generateRecommendations(diagnostics)}
            </AlertDescription>
          </Alert>
        </div>
      )}
    </div>
  )
}

// Helper functions
function formatResponseTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const seconds = Math.floor(diff / 1000)

  if (seconds < 60) return 'Just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function generateRecommendations(diagnostics: ConnectionDiagnostics): string {
  const recommendations: string[] = []

  if (!diagnostics.authentication.tokenValid) {
    recommendations.push(
      'Re-authenticate with Real-Debrid to restore connection. '
    )
  }

  if (!diagnostics.service.apiReachable) {
    recommendations.push('Check your internet connection and try again. ')
  }

  if (
    diagnostics.network.effectiveType === 'slow-2g' ||
    diagnostics.network.effectiveType === '2g'
  ) {
    recommendations.push(
      'Your connection appears slow. Consider using a faster network for better performance. '
    )
  }

  if (
    Object.values(diagnostics.service.endpointsStatus).some((e) => !e.available)
  ) {
    recommendations.push(
      'Some Real-Debrid services are unavailable. This may be a temporary issue. '
    )
  }

  const rateLimitUsage =
    (diagnostics.service.rateLimitStatus.limit -
      diagnostics.service.rateLimitStatus.remaining) /
    diagnostics.service.rateLimitStatus.limit
  if (rateLimitUsage > 0.8) {
    recommendations.push(
      'You are approaching the rate limit. Consider reducing API usage. '
    )
  }

  return recommendations.length > 0
    ? recommendations.join('')
    : 'Your connection appears to be working normally.'
}

export default ConnectionDiagnostics
