import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Loader2,
  ExternalLink,
  Shield,
  ShieldOff,
  CheckCircle,
  AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface AuthButtonProps {
  isAuthenticated: boolean
  isLoading: boolean
  user?: {
    username: string
    premium: boolean
  } | null
  onLogin: () => void
  onLogout: () => void
  className?: string
}

export function AuthButton({
  isAuthenticated,
  isLoading,
  user,
  onLogin,
  onLogout,
  className,
}: AuthButtonProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (isLoading) {
    return (
      <Button disabled className={cn('w-full', className)}>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Connecting...
      </Button>
    )
  }

  if (isAuthenticated && user) {
    return (
      <Card className={cn('w-full max-w-md', className)}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <CardTitle className="text-lg">
                Connected to Real-Debrid
              </CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? 'Show Less' : 'Show More'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{user.username}</p>
              <p className="text-muted-foreground flex items-center gap-1 text-sm">
                {user.premium ? (
                  <>
                    <Shield className="h-3 w-3 text-yellow-500" />
                    Premium Account
                  </>
                ) : (
                  <>
                    <ShieldOff className="h-3 w-3 text-gray-500" />
                    Free Account
                  </>
                )}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={onLogout}>
              Disconnect
            </Button>
          </div>

          {isExpanded && (
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Status:</span>
                <span className="font-medium text-green-600">Active</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Access:</span>
                <span className="font-medium">Full API Access</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Files:</span>
                <span className="font-medium">Sync Ready</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn('w-full max-w-md', className)}>
      <CardHeader>
        <div className="mb-2 flex items-center space-x-2">
          <ExternalLink className="h-5 w-5 text-blue-500" />
          <CardTitle>Connect to Real-Debrid</CardTitle>
        </div>
        <CardDescription>
          Connect your Real-Debrid account to access and organize your premium
          media files.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="text-muted-foreground flex items-center space-x-2 text-sm">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span>Secure OAuth2 authentication</span>
          </div>
          <div className="text-muted-foreground flex items-center space-x-2 text-sm">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span>Access all your media files</span>
          </div>
          <div className="text-muted-foreground flex items-center space-x-2 text-sm">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span>Premium features support</span>
          </div>
        </div>

        <Button onClick={onLogin} className="w-full">
          <ExternalLink className="mr-2 h-4 w-4" />
          Connect Real-Debrid Account
        </Button>

        <div className="text-muted-foreground flex items-start space-x-2 text-xs">
          <AlertCircle className="mt-0.5 h-3 w-3 flex-shrink-0" />
          <p>
            You&apos;ll be redirected to Real-Debrid to authorize this
            application. Your credentials are never stored and the connection
            can be revoked at any time.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
