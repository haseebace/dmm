import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useOAuth2Auth } from '../use-oauth2-auth'
import { oauth2TokenStorage } from '../../lib/oauth2/token-storage'
import { oauth2Client } from '../../lib/oauth2/client'

// Mock the modules
vi.mock('../../lib/oauth2/token-storage')
vi.mock('../../lib/oauth2/client')
vi.mock('../../lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}))

// Mock fetch
global.fetch = vi.fn()

describe('useOAuth2Auth', () => {
  let mockTokenStorage: {
    getUserFromTokens: ReturnType<typeof vi.fn>
    getTokens: ReturnType<typeof vi.fn>
    updateTokens: ReturnType<typeof vi.fn>
    deleteTokens: ReturnType<typeof vi.fn>
    isTokenExpired: ReturnType<typeof vi.fn>
  }
  let mockOAuth2Client: {
    refreshAccessToken: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    vi.clearAllMocks()

    mockTokenStorage = {
      getUserFromTokens: vi.fn(),
      getTokens: vi.fn(),
      updateTokens: vi.fn(),
      deleteTokens: vi.fn(),
      isTokenExpired: vi.fn(),
    }

    mockOAuth2Client = {
      refreshAccessToken: vi.fn(),
    }(oauth2TokenStorage as any).mockImplementation(() => mockTokenStorage)
    ;(oauth2Client as any).mockImplementation(() => mockOAuth2Client)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unmock('@/lib/oauth2/token-storage')
    vi.unmock('@/lib/oauth2/client')
  })

  describe('initial state', () => {
    it('should start with loading state', () => {
      mockTokenStorage.getUserFromTokens.mockResolvedValue(null)

      const { result } = renderHook(() => useOAuth2Auth())

      expect(result.current.isLoading).toBe(true)
      expect(result.current.status).toBe('loading')
      expect(result.current.isAuthenticated).toBe(false)
    })

    it('should check authentication status on mount', () => {
      mockTokenStorage.getUserFromTokens.mockResolvedValue(null)

      renderHook(() => useOAuth2Auth())

      expect(mockTokenStorage.getUserFromTokens).toHaveBeenCalledTimes(1)
    })
  })

  describe('authenticated state', () => {
    const mockUser = {
      id: 'user-123',
      username: 'testuser',
      premium: true,
      email: 'test@example.com',
    }

    it('should set authenticated state when user is found', async () => {
      mockTokenStorage.getUserFromTokens.mockResolvedValue(mockUser)

      const { result } = renderHook(() => useOAuth2Auth())

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true)
        expect(result.current.status).toBe('authenticated')
        expect(result.current.user).toEqual(mockUser)
        expect(result.current.isLoading).toBe(false)
      })
    })

    it('should set idle state when no user is found', async () => {
      mockTokenStorage.getUserFromTokens.mockResolvedValue(null)

      const { result } = renderHook(() => useOAuth2Auth())

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(false)
        expect(result.current.status).toBe('idle')
        expect(result.current.user).toBeNull()
        expect(result.current.isLoading).toBe(false)
      })
    })

    it('should set error state when authentication check fails', async () => {
      mockTokenStorage.getUserFromTokens.mockRejectedValue(
        new Error('Database error')
      )

      const { result } = renderHook(() => useOAuth2Auth())

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(false)
        expect(result.current.status).toBe('error')
        expect(result.current.error?.error).toBe('auth_check_failed')
        expect(result.current.isLoading).toBe(false)
      })
    })
  })

  describe('login function', () => {
    it('should initiate OAuth2 authorization flow', async () => {
      mockTokenStorage.getUserFromTokens.mockResolvedValue(null)
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          authorizationUrl: 'https://real-debrid.com/oauth/auth',
          state: 'test-state',
        }),
      })

      const { result } = renderHook(() => useOAuth2Auth())

      // Wait for initial authentication check
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Mock window.location.href
      const originalLocation = window.location
      delete (window as { location?: Location }).location
      window.location = { href: '' } as Location

      await act(async () => {
        await result.current.login()
      })

      expect(fetch).toHaveBeenCalledWith('/api/auth/oauth2/authorize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      expect(window.location.href).toBe('https://real-debrid.com/oauth/auth')

      // Restore original location
      window.location = originalLocation
    })

    it('should handle login errors', async () => {
      mockTokenStorage.getUserFromTokens.mockResolvedValue(null)
      vi.mocked(fetch).mockRejectedValue(new Error('Network error'))

      const { result } = renderHook(() => useOAuth2Auth())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      await act(async () => {
        await result.current.login()
      })

      expect(result.current.status).toBe('error')
      expect(result.current.error?.error).toBe('login_failed')
      expect(result.current.isLoading).toBe(false)
    })
  })

  describe('logout function', () => {
    const mockUser = {
      id: 'user-123',
      username: 'testuser',
      premium: false,
    }

    it('should revoke tokens and clear authentication state', async () => {
      mockTokenStorage.getUserFromTokens.mockResolvedValue(mockUser)
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          message: 'Tokens revoked successfully',
        }),
      })

      const { result } = renderHook(() => useOAuth2Auth())

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true)
      })

      await act(async () => {
        await result.current.logout()
      })

      expect(fetch).toHaveBeenCalledWith('/api/auth/oauth2/revoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(false)
        expect(result.current.status).toBe('idle')
        expect(result.current.user).toBeNull()
      })
    })

    it('should handle logout errors', async () => {
      mockTokenStorage.getUserFromTokens.mockResolvedValue(mockUser)
      vi.mocked(fetch).mockRejectedValue(new Error('Logout failed'))

      const { result } = renderHook(() => useOAuth2Auth())

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true)
      })

      await act(async () => {
        await result.current.logout()
      })

      expect(result.current.status).toBe('error')
      expect(result.current.error?.error).toBe('logout_failed')
    })
  })

  describe('handleCallback function', () => {
    it('should handle OAuth2 callback successfully', async () => {
      mockTokenStorage.getUserFromTokens.mockResolvedValue(null)
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          user: {
            id: 'user-123',
            username: 'testuser',
            premium: true,
          },
        }),
      })

      const { result } = renderHook(() => useOAuth2Auth())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      await act(async () => {
        const callbackResult = await result.current.handleCallback(
          'test-code',
          'test-state'
        )
        expect(callbackResult.success).toBe(true)
      })

      expect(fetch).toHaveBeenCalledWith('/api/auth/oauth2/callback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: 'test-code', state: 'test-state' }),
      })

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true)
        expect(result.current.status).toBe('authenticated')
        expect(result.current.user?.username).toBe('testuser')
        expect(result.current.user?.premium).toBe(true)
      })
    })

    it('should handle callback errors', async () => {
      mockTokenStorage.getUserFromTokens.mockResolvedValue(null)
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        json: async () => ({
          success: false,
          message: 'Invalid authorization code',
        }),
      })

      const { result } = renderHook(() => useOAuth2Auth())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      await act(async () => {
        await expect(
          result.current.handleCallback('invalid-code', 'test-state')
        ).rejects.toThrow('Invalid authorization code')
      })

      await waitFor(() => {
        expect(result.current.status).toBe('error')
        expect(result.current.error?.error).toBe('callback_failed')
      })
    })
  })

  describe('clearError function', () => {
    it('should clear error state', async () => {
      mockTokenStorage.getUserFromTokens.mockRejectedValue(
        new Error('Test error')
      )

      const { result } = renderHook(() => useOAuth2Auth())

      await waitFor(() => {
        expect(result.current.status).toBe('error')
      })

      act(() => {
        result.current.clearError()
      })

      expect(result.current.error).toBeNull()
      expect(result.current.status).toBe('idle')
    })
  })

  describe('auto refresh', () => {
    const mockUser = {
      id: 'user-123',
      username: 'testuser',
      premium: false,
    }

    it('should not auto-refresh when disabled', async () => {
      mockTokenStorage.getUserFromTokens.mockResolvedValue(mockUser)

      const { result } = renderHook(() => useOAuth2Auth({ autoRefresh: false }))

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true)
      })

      // Check that refresh-related utilities are false
      expect(result.current.canRefreshTokens).toBe(false)
    })

    it('should enable auto-refresh when user is authenticated', async () => {
      mockTokenStorage.getUserFromTokens.mockResolvedValue(mockUser)
      mockTokenStorage.getTokens.mockResolvedValue({
        accessToken: 'test-token',
        refreshToken: 'refresh-token',
        tokenType: 'Bearer',
        expiresIn: 3600,
        scope: 'openid',
        createdAt: Date.now(),
      })
      mockTokenStorage.isTokenExpired.mockReturnValue(false)

      const { result } = renderHook(() => useOAuth2Auth({ autoRefresh: true }))

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true)
      })

      expect(result.current.canRefreshTokens).toBe(true)
    })
  })
})
