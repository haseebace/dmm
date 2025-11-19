import { useState, useEffect, useCallback } from 'react'
import { OAuth2AuthState } from '@/types/oauth2'
import { oauth2TokenStorage } from '@/lib/oauth2/token-storage'
import { oauth2Client } from '@/lib/oauth2/client'
import { logger } from '@/lib/logger'

interface UseOAuth2AuthOptions {
  autoRefresh?: boolean
  refreshBuffer?: number
}

export function useOAuth2Auth(options: UseOAuth2AuthOptions = {}) {
  const {
    autoRefresh = true,
    refreshBuffer = 5, // 5 minutes buffer before expiration
  } = options

  const [state, setState] = useState<OAuth2AuthState>({
    status: 'idle',
    user: null,
    error: null,
    isAuthenticated: false,
    isLoading: false,
  })

  // Check current authentication status
  const checkAuthStatus = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, status: 'loading' }))

    try {
      const user = await oauth2TokenStorage.getUserFromTokens()

      if (user) {
        setState({
          status: 'authenticated',
          user,
          error: null,
          isAuthenticated: true,
          isLoading: false,
        })

        logger.info('OAuth2 authentication status checked', 'oauth2', {
          userId: user.id,
          username: user.username,
          premium: user.premium,
        })
      } else {
        setState({
          status: 'idle',
          user: null,
          error: null,
          isAuthenticated: false,
          isLoading: false,
        })
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Authentication check failed'
      logger.error('Failed to check OAuth2 authentication status', 'oauth2', {
        error: errorMessage,
      })

      setState({
        status: 'error',
        user: null,
        error: {
          error: 'auth_check_failed',
          error_description: errorMessage,
        },
        isAuthenticated: false,
        isLoading: false,
      })
    }
  }, [])

  // Initialize authentication status
  useEffect(() => {
    checkAuthStatus()
  }, [checkAuthStatus])

  // Auto-refresh tokens if enabled
  useEffect(() => {
    if (!autoRefresh || state.status !== 'authenticated') {
      return
    }

    const refreshInterval = setInterval(async () => {
      try {
        const user = state.user
        if (!user) return

        const tokens = await oauth2TokenStorage.getTokens(user.id)
        if (!tokens || !tokens.refreshToken) return

        // Check if token needs refresh
        const isExpired = oauth2TokenStorage.isTokenExpired(
          tokens,
          refreshBuffer
        )
        if (!isExpired) return

        logger.info('Refreshing OAuth2 tokens', 'oauth2', {
          userId: user.id,
        })

        const newTokens = await oauth2Client.refreshAccessToken(
          tokens.refreshToken
        )
        await oauth2TokenStorage.updateTokens(user.id, newTokens)

        logger.info('Successfully refreshed OAuth2 tokens', 'oauth2', {
          userId: user.id,
          hasRefreshToken: !!newTokens.refreshToken,
        })
      } catch (error) {
        logger.error('Failed to refresh OAuth2 tokens', 'oauth2', {
          error: error instanceof Error ? error.message : 'Unknown error',
        })

        // Mark as revoked on refresh failure
        setState((prev) => ({
          ...prev,
          status: 'revoked',
          error: {
            error: 'token_refresh_failed',
            error_description:
              'Failed to refresh tokens. Please re-authenticate.',
          },
          isAuthenticated: false,
        }))
      }
    }, 60000) // Check every minute

    return () => clearInterval(refreshInterval)
  }, [autoRefresh, refreshBuffer, state.status, state.user])

  // Login function
  const login = useCallback(async () => {
    setState((prev) => ({
      ...prev,
      isLoading: true,
      error: null,
      status: 'loading',
    }))

    try {
      const response = await fetch('/api/auth/oauth2/authorize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to initiate authorization: ${response.status}`)
      }

      const data = await response.json()

      // Redirect to Real-Debrid authorization URL
      window.location.href = data.authorizationUrl
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Login failed'
      logger.error('OAuth2 login failed', 'oauth2', {
        error: errorMessage,
      })

      setState({
        status: 'error',
        user: null,
        error: {
          error: 'login_failed',
          error_description: errorMessage,
        },
        isAuthenticated: false,
        isLoading: false,
      })
    }
  }, [])

  // Logout function
  const logout = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, status: 'loading' }))

    try {
      const response = await fetch('/api/auth/oauth2/revoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to revoke tokens: ${response.status}`)
      }

      logger.info('OAuth2 logout successful', 'oauth2')

      setState({
        status: 'idle',
        user: null,
        error: null,
        isAuthenticated: false,
        isLoading: false,
      })
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Logout failed'
      logger.error('OAuth2 logout failed', 'oauth2', {
        error: errorMessage,
      })

      setState({
        status: 'error',
        user: null,
        error: {
          error: 'logout_failed',
          error_description: errorMessage,
        },
        isAuthenticated: false,
        isLoading: false,
      })
    }
  }, [])

  // Handle OAuth2 callback
  const handleCallback = useCallback(async (code: string, state: string) => {
    setState((prev) => ({ ...prev, isLoading: true, status: 'loading' }))

    try {
      const response = await fetch('/api/auth/oauth2/callback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code, state }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'OAuth2 callback failed')
      }

      setState({
        status: 'authenticated',
        user: data.user,
        error: null,
        isAuthenticated: true,
        isLoading: false,
      })

      logger.info('OAuth2 authentication completed', 'oauth2', {
        userId: data.user?.id,
        username: data.user?.username,
      })

      return data
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Authentication failed'
      logger.error('OAuth2 callback failed', 'oauth2', {
        error: errorMessage,
      })

      setState({
        status: 'error',
        user: null,
        error: {
          error: 'callback_failed',
          error_description: errorMessage,
        },
        isAuthenticated: false,
        isLoading: false,
      })

      throw error
    }
  }, [])

  // Clear error state
  const clearError = useCallback(() => {
    setState((prev) => ({
      ...prev,
      error: null,
      status: prev.isAuthenticated ? 'authenticated' : 'idle',
    }))
  }, [])

  return {
    ...state,
    login,
    logout,
    checkAuthStatus,
    handleCallback,
    clearError,
    // Additional utilities
    canRefreshTokens: autoRefresh && state.user !== null,
    isRefreshing: state.status === 'loading' && state.isAuthenticated,
  }
}
