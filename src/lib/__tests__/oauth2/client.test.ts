import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { OAuth2Client } from '@/lib/oauth2/client'
import { config } from '@/lib/config'

// Mock the config module
vi.mock('@/lib/config', () => ({
  config: {
    realDebrid: {
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      redirectUri: 'http://localhost:3000/api/auth/callback',
    },
  },
}))

// Mock the logger module
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    performance: vi.fn(),
    warn: vi.fn(),
  },
}))

// Mock global fetch
global.fetch = vi.fn()

describe('OAuth2Client', () => {
  let oauth2Client: OAuth2Client

  beforeEach(() => {
    oauth2Client = new OAuth2Client()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('generateState', () => {
    it('should generate OAuth2 state with required properties', () => {
      const state = oauth2Client.generateState()

      expect(state).toHaveProperty('state')
      expect(state).toHaveProperty('codeVerifier')
      expect(state).toHaveProperty('codeChallenge')
      expect(state).toHaveProperty('redirectUri')
      expect(state).toHaveProperty('createdAt')
      expect(state.redirectUri).toBe(config.realDebrid.redirectUri)
      expect(typeof state.state).toBe('string')
      expect(typeof state.codeVerifier).toBe('string')
      expect(typeof state.codeChallenge).toBe('string')
      expect(typeof state.createdAt).toBe('number')
      expect(state.state.length).toBeGreaterThan(0)
      expect(state.codeVerifier.length).toBeGreaterThan(0)
      expect(state.codeChallenge.length).toBeGreaterThan(0)
    })

    it('should generate unique states', () => {
      const state1 = oauth2Client.generateState()
      const state2 = oauth2Client.generateState()

      expect(state1.state).not.toBe(state2.state)
      expect(state1.codeVerifier).not.toBe(state2.codeVerifier)
      expect(state1.codeChallenge).not.toBe(state2.codeChallenge)
    })
  })

  describe('createAuthorizationUrl', () => {
    it('should create authorization URL with correct parameters', () => {
      const state = oauth2Client.generateState()
      const authUrl = oauth2Client.createAuthorizationUrl(state)

      expect(authUrl).toContain('https://api.real-debrid.com/oauth/v2/auth')
      expect(authUrl).toContain('client_id=test-client-id')
      expect(authUrl).toContain(
        `redirect_uri=${encodeURIComponent(config.realDebrid.redirectUri)}`
      )
      expect(authUrl).toContain('response_type=code')
      expect(authUrl).toContain('scope=openid+offline_access')
      expect(authUrl).toContain(`state=${state.state}`)
      expect(authUrl).toContain('code_challenge=')
      expect(authUrl).toContain('code_challenge_method=S256')
    })

    it('should use the provided state', () => {
      const customState = oauth2Client.generateState()
      const authUrl = oauth2Client.createAuthorizationUrl(customState)

      expect(authUrl).toContain(`state=${customState.state}`)
      expect(authUrl).toContain(`code_challenge=${customState.codeChallenge}`)
    })
  })

  describe('exchangeCodeForTokens', () => {
    it('should successfully exchange authorization code for tokens', async () => {
      const mockResponse = {
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'openid offline_access',
      }

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response)

      const state = oauth2Client.generateState()
      const tokens = await oauth2Client.exchangeCodeForTokens(
        'test-auth-code',
        state
      )

      expect(tokens).toEqual({
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        tokenType: 'Bearer',
        expiresIn: 3600,
        scope: 'openid offline_access',
        createdAt: expect.any(Number),
      })

      expect(fetch).toHaveBeenCalledWith(
        'https://api.real-debrid.com/oauth/v2/token',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        })
      )

      // Check that the body contains the required parameters
      const fetchCall = vi.mocked(fetch).mock.calls[0]
      expect(fetchCall[1]?.body).toBeInstanceOf(URLSearchParams)
      expect(fetchCall[1]?.body.toString()).toContain(
        'grant_type=authorization_code'
      )
      expect(fetchCall[1]?.body.toString()).toContain('code=test-auth-code')
      expect(fetchCall[1]?.body.toString()).toContain(
        'redirect_uri=' + encodeURIComponent(config.realDebrid.redirectUri)
      )
    })

    it('should handle token exchange errors', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Invalid authorization code',
      } as Response)

      const state = oauth2Client.generateState()

      await expect(
        oauth2Client.exchangeCodeForTokens('invalid-code', state)
      ).rejects.toThrow('Token exchange failed: 400 Invalid authorization code')
    })
  })

  describe('getUserInfo', () => {
    it('should successfully fetch user information', async () => {
      const mockUserData = {
        id: 'test-user-id',
        username: 'testuser',
        email: 'test@example.com',
        avatar: 'https://example.com/avatar.jpg',
        premium: true,
        expiration: '2024-12-31',
      }

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockUserData,
      } as Response)

      const userInfo = await oauth2Client.getUserInfo('test-access-token')

      expect(userInfo).toEqual(mockUserData)

      expect(fetch).toHaveBeenCalledWith(
        'https://api.real-debrid.com/rest/1.0/user',
        {
          headers: {
            Authorization: 'Bearer test-access-token',
          },
        }
      )
    })

    it('should handle user info fetch errors', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as Response)

      await expect(oauth2Client.getUserInfo('invalid-token')).rejects.toThrow(
        'Failed to get user info: 401'
      )
    })
  })

  describe('refreshAccessToken', () => {
    it('should successfully refresh access token', async () => {
      const mockResponse = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'openid offline_access',
      }

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response)

      const tokens = await oauth2Client.refreshAccessToken('old-refresh-token')

      expect(tokens).toEqual({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        tokenType: 'Bearer',
        expiresIn: 3600,
        scope: 'openid offline_access',
        createdAt: expect.any(Number),
      })

      expect(fetch).toHaveBeenCalledWith(
        'https://api.real-debrid.com/oauth/v2/token',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        })
      )

      // Check that the body contains both required parameters
      const fetchCall = vi.mocked(fetch).mock.calls[0]
      expect(fetchCall[1]?.body).toBeInstanceOf(URLSearchParams)
      expect(fetchCall[1]?.body.toString()).toContain(
        'grant_type=refresh_token'
      )
      expect(fetchCall[1]?.body.toString()).toContain(
        'refresh_token=old-refresh-token'
      )
    })

    it('should handle refresh token errors', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Invalid refresh token',
      } as Response)

      await expect(
        oauth2Client.refreshAccessToken('invalid-refresh-token')
      ).rejects.toThrow('Token refresh failed: 400 Invalid refresh token')
    })

    it('should use original refresh token when new one is not provided', async () => {
      const mockResponse = {
        access_token: 'new-access-token',
        // No refresh_token in response
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'openid offline_access',
      }

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response)

      const tokens = await oauth2Client.refreshAccessToken(
        'original-refresh-token'
      )

      expect(tokens.refreshToken).toBe('original-refresh-token')
    })
  })

  describe('revokeToken', () => {
    it('should successfully revoke a token', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
      } as Response)

      await expect(
        oauth2Client.revokeToken('test-token')
      ).resolves.toBeUndefined()

      expect(fetch).toHaveBeenCalledWith(
        'https://api.real-debrid.com/oauth/v2/revoke',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        })
      )

      // Check that the body contains both required parameters
      const fetchCall = vi.mocked(fetch).mock.calls[0]
      expect(fetchCall[1]?.body).toBeInstanceOf(URLSearchParams)
      expect(fetchCall[1]?.body.toString()).toContain('token=test-token')
      expect(fetchCall[1]?.body.toString()).toContain('action=revoke')
    })

    it('should handle token revocation errors', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 400,
      } as Response)

      await expect(oauth2Client.revokeToken('invalid-token')).rejects.toThrow(
        'Token revocation failed: 400'
      )
    })
  })
})
