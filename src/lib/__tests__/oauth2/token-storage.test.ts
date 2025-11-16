import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { OAuth2TokenStorage } from '@/lib/oauth2/token-storage'
import { supabaseClient } from '@/lib/supabase/client'

// Mock the Supabase client
vi.mock('@/lib/supabase/client', () => ({
  supabaseClient: {
    from: vi.fn(),
    auth: {
      getUser: vi.fn(),
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

describe('OAuth2TokenStorage', () => {
  let tokenStorage: OAuth2TokenStorage
  let mockSupabase: ReturnType<typeof vi.fn> & {
    select: ReturnType<typeof vi.fn>
    eq: ReturnType<typeof vi.fn>
    single: ReturnType<typeof vi.fn>
    upsert: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    delete: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    tokenStorage = new OAuth2TokenStorage()
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi
        .fn()
        .mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
    }

    vi.mocked(supabaseClient).from.mockReturnValue(mockSupabase)
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('storeTokens', () => {
    it('should successfully store OAuth2 tokens', async () => {
      const mockTokens = {
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        tokenType: 'Bearer',
        expiresIn: 3600,
        scope: 'openid offline_access',
        createdAt: Date.now(),
      }

      mockSupabase.upsert.mockResolvedValue({ error: null })

      await expect(
        tokenStorage.storeTokens('user-123', mockTokens)
      ).resolves.toBeUndefined()

      expect(supabaseClient.from).toHaveBeenCalledWith('oauth_tokens')
      expect(mockSupabase.upsert).toHaveBeenCalledWith(
        {
          user_id: 'user-123',
          access_token: 'test-access-token',
          refresh_token: 'test-refresh-token',
          token_type: 'Bearer',
          expires_in: 3600,
          scope: 'openid offline_access',
          created_at: expect.any(String),
          updated_at: expect.any(String),
        },
        {
          onConflict: 'user_id',
        }
      )
    })

    it('should handle storage errors', async () => {
      const mockTokens = {
        accessToken: 'test-access-token',
        tokenType: 'Bearer',
        expiresIn: 3600,
        scope: 'openid',
        createdAt: Date.now(),
      }

      mockSupabase.upsert.mockResolvedValue({
        error: { message: 'Database error' },
      })

      await expect(
        tokenStorage.storeTokens('user-123', mockTokens)
      ).rejects.toThrow('Failed to store tokens: Database error')
    })

    it('should handle null refresh token', async () => {
      const mockTokens = {
        accessToken: 'test-access-token',
        tokenType: 'Bearer',
        expiresIn: 3600,
        scope: 'openid',
        createdAt: Date.now(),
      }

      mockSupabase.upsert.mockResolvedValue({ error: null })

      await expect(
        tokenStorage.storeTokens('user-123', mockTokens)
      ).resolves.toBeUndefined()

      expect(mockSupabase.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          refresh_token: null,
        }),
        { onConflict: 'user_id' }
      )
    })
  })

  describe('getTokens', () => {
    it('should successfully retrieve OAuth2 tokens', async () => {
      const mockDbTokens = {
        id: 'token-id',
        user_id: 'user-123',
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'openid offline_access',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      }

      mockSupabase.single.mockResolvedValue({
        data: mockDbTokens,
        error: null,
      })

      const tokens = await tokenStorage.getTokens('user-123')

      expect(tokens).toEqual({
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        tokenType: 'Bearer',
        expiresIn: 3600,
        scope: 'openid offline_access',
        createdAt: expect.any(Number),
      })

      expect(supabaseClient.from).toHaveBeenCalledWith('oauth_tokens')
      expect(mockSupabase.select).toHaveBeenCalledWith('*')
      expect(mockSupabase.eq).toHaveBeenCalledWith('user_id', 'user-123')
    })

    it('should return null when no tokens found', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      })

      const tokens = await tokenStorage.getTokens('user-123')

      expect(tokens).toBeNull()
    })

    it('should handle null refresh token in database', async () => {
      const mockDbTokens = {
        id: 'token-id',
        user_id: 'user-123',
        access_token: 'test-access-token',
        refresh_token: null,
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'openid',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      }

      mockSupabase.single.mockResolvedValue({
        data: mockDbTokens,
        error: null,
      })

      const tokens = await tokenStorage.getTokens('user-123')

      expect(tokens?.refreshToken).toBeUndefined()
    })

    it('should handle retrieval errors', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      })

      await expect(tokenStorage.getTokens('user-123')).rejects.toThrow(
        'Failed to retrieve tokens: Database error'
      )
    })
  })

  describe('updateTokens', () => {
    it('should successfully update OAuth2 tokens', async () => {
      const updateData = {
        accessToken: 'new-access-token',
        expiresIn: 7200,
      }

      // Mock the complete chain: update() returns mock with eq() that resolves to result
      const mockUpdateResult = { error: null }
      mockSupabase.update.mockReturnValue({
        eq: vi.fn().mockResolvedValue(mockUpdateResult),
      })

      await expect(
        tokenStorage.updateTokens('user-123', updateData)
      ).resolves.toBeUndefined()

      expect(mockSupabase.update).toHaveBeenCalledWith({
        updated_at: expect.any(String),
        access_token: 'new-access-token',
        expires_in: 7200,
      })
    })

    it('should handle update errors', async () => {
      mockSupabase.update.mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          error: { message: 'Database error' },
        }),
      })

      await expect(
        tokenStorage.updateTokens('user-123', { accessToken: 'new-token' })
      ).rejects.toThrow('Failed to update tokens: Database error')
    })
  })

  describe('deleteTokens', () => {
    it('should successfully delete OAuth2 tokens', async () => {
      mockSupabase.delete.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })

      await expect(
        tokenStorage.deleteTokens('user-123')
      ).resolves.toBeUndefined()

      expect(supabaseClient.from).toHaveBeenCalledWith('oauth_tokens')
      expect(mockSupabase.delete).toHaveBeenCalled()
    })

    it('should handle deletion errors', async () => {
      mockSupabase.delete.mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          error: { message: 'Database error' },
        }),
      })

      await expect(tokenStorage.deleteTokens('user-123')).rejects.toThrow(
        'Failed to delete tokens: Database error'
      )
    })
  })

  describe('isTokenExpired', () => {
    it('should return true for expired tokens', () => {
      const expiredTokens = {
        accessToken: 'test-token',
        tokenType: 'Bearer',
        expiresIn: 3600,
        scope: 'openid',
        createdAt: Date.now() - 4000 * 1000, // 4000 seconds ago
      }

      expect(tokenStorage.isTokenExpired(expiredTokens)).toBe(true)
    })

    it('should return false for valid tokens', () => {
      const validTokens = {
        accessToken: 'test-token',
        tokenType: 'Bearer',
        expiresIn: 3600,
        scope: 'openid',
        createdAt: Date.now() - 1000 * 1000, // 1000 seconds ago
      }

      expect(tokenStorage.isTokenExpired(validTokens)).toBe(false)
    })

    it('should return true for tokens expiring within buffer time', () => {
      const soonToExpireTokens = {
        accessToken: 'test-token',
        tokenType: 'Bearer',
        expiresIn: 3600,
        scope: 'openid',
        createdAt: Date.now() - 3500 * 1000, // 3500 seconds ago (expires in 100s, but buffer is 5min)
      }

      expect(tokenStorage.isTokenExpired(soonToExpireTokens, 5)).toBe(true)
    })

    it('should return false for tokens with enough buffer time', () => {
      const validWithBufferTokens = {
        accessToken: 'test-token',
        tokenType: 'Bearer',
        expiresIn: 3600,
        scope: 'openid',
        createdAt: Date.now() - 3000 * 1000, // 3000 seconds ago (expires in 600s)
      }

      expect(tokenStorage.isTokenExpired(validWithBufferTokens, 5)).toBe(false)
    })
  })

  describe('getUserFromTokens', () => {
    it('should return user info when valid tokens exist', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        user_metadata: { username: 'testuser' },
      }

      const mockTokens = {
        accessToken: 'test-token',
        tokenType: 'Bearer',
        expiresIn: 3600,
        scope: 'openid',
        createdAt: Date.now() - 1000 * 1000,
      }

      vi.mocked(supabaseClient.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })

      mockSupabase.single.mockResolvedValue({
        data: {
          ...mockTokens,
          created_at: '2024-01-01T00:00:00Z',
        },
        error: null,
      })

      const userInfo = await tokenStorage.getUserFromTokens()

      expect(userInfo).toEqual({
        id: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        premium: false,
      })

      expect(supabaseClient.auth.getUser).toHaveBeenCalled()
    })

    it('should return null when no authenticated user', async () => {
      vi.mocked(supabaseClient.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: { message: 'No user' },
      })

      const userInfo = await tokenStorage.getUserFromTokens()

      expect(userInfo).toBeNull()
    })

    it('should return null when no OAuth2 tokens exist', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
      }

      vi.mocked(supabaseClient.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })

      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      })

      const userInfo = await tokenStorage.getUserFromTokens()

      expect(userInfo).toBeNull()
    })

    it('should return null when tokens are expired', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
      }

      // Create a timestamp that would result in expired tokens
      // (4000 seconds ago with expiresIn of 3600 seconds = expired)
      const expiredCreatedAt = new Date(Date.now() - 4000 * 1000).toISOString()

      vi.mocked(supabaseClient.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })

      mockSupabase.single.mockResolvedValue({
        data: {
          access_token: 'test-token',
          refresh_token: null,
          token_type: 'Bearer',
          expires_in: 3600,
          scope: 'openid',
          created_at: expiredCreatedAt, // Use the expired timestamp
        },
        error: null,
      })

      const userInfo = await tokenStorage.getUserFromTokens()

      expect(userInfo).toBeNull()
    })
  })
})
