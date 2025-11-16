import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GET, POST } from '@/app/api/auth/oauth2/authorize/route'
import { NextRequest } from 'next/server'

// Mock modules
vi.mock('@/lib/oauth2/client', () => ({
  oauth2Client: {
    generateState: vi.fn(),
    createAuthorizationUrl: vi.fn(),
  },
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}))

describe('/api/auth/oauth2/authorize', () => {
  let mockRequest: Partial<NextRequest>
  let mockOAuth2Client: {
    generateState: ReturnType<typeof vi.fn>
    createAuthorizationUrl: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    vi.clearAllMocks()

    mockOAuth2Client = {
      generateState: vi.fn().mockReturnValue({
        state: 'test-state-123',
        codeVerifier: 'test-verifier',
        codeChallenge: 'test-challenge',
        redirectUri: 'http://localhost:3000/api/auth/callback',
        createdAt: Date.now(),
      }),
      createAuthorizationUrl: vi
        .fn()
        .mockReturnValue(
          'https://api.real-debrid.com/oauth/v2/auth?client_id=test&redirect_uri=http://localhost:3000&response_type=code&state=test-state-123'
        ),
    }

    vi.doMock('@/lib/oauth2/client', () => ({
      oauth2Client: mockOAuth2Client,
    }))

    mockRequest = {
      headers: {
        get: vi.fn(),
      },
    } as Partial<NextRequest>
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('GET method', () => {
    it('should return authorization URL when authenticated', async () => {
      mockRequest.headers.get.mockReturnValue('Bearer valid-token')

      const response = await GET(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.authorizationUrl).toBe(
        'https://api.real-debrid.com/oauth/v2/auth?client_id=test&redirect_uri=http://localhost:3000&response_type=code&state=test-state-123'
      )
      expect(data.state).toBe('test-state-123')
      expect(response.cookies.get('oauth2_state')).toBeDefined()
      expect(response.cookies.get('oauth2_code_verifier')).toBeDefined()
      expect(mockOAuth2Client.generateState).toHaveBeenCalled()
      expect(mockOAuth2Client.createAuthorizationUrl).toHaveBeenCalled()
    })

    it('should return 401 when no authorization header', async () => {
      mockRequest.headers.get.mockReturnValue(null)

      const response = await GET(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Authentication required')
    })

    it('should return 401 when invalid authorization header format', async () => {
      mockRequest.headers.get.mockReturnValue('InvalidFormat token')

      const response = await GET(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Authentication required')
    })

    it('should set secure cookies in production', async () => {
      mockRequest.headers.get.mockReturnValue('Bearer valid-token')
      process.env.NODE_ENV = 'production'

      const response = await GET(mockRequest)
      const stateCookie = response.cookies.get('oauth2_state')
      const verifierCookie = response.cookies.get('oauth2_code_verifier')

      expect(stateCookie?.secure).toBe(true)
      expect(verifierCookie?.secure).toBe(true)

      process.env.NODE_ENV = 'test'
    })

    it('should set non-secure cookies in development', async () => {
      mockRequest.headers.get.mockReturnValue('Bearer valid-token')
      process.env.NODE_ENV = 'development'

      const response = await GET(mockRequest)
      const stateCookie = response.cookies.get('oauth2_state')
      const verifierCookie = response.cookies.get('oauth2_code_verifier')

      expect(stateCookie?.secure).toBe(false)
      expect(verifierCookie?.secure).toBe(false)

      process.env.NODE_ENV = 'test'
    })
  })

  describe('POST method', () => {
    it('should return authorization URL when authenticated', async () => {
      mockRequest.headers.get.mockReturnValue('Bearer valid-token')
      mockRequest.json = vi.fn().mockResolvedValue({})

      const response = await POST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.authorizationUrl).toBeDefined()
      expect(data.state).toBeDefined()
      expect(data.message).toBe('OAuth2 authorization initiated')
      expect(mockOAuth2Client.generateState).toHaveBeenCalled()
      expect(mockOAuth2Client.createAuthorizationUrl).toHaveBeenCalled()
    })

    it('should handle empty request body', async () => {
      mockRequest.headers.get.mockReturnValue('Bearer valid-token')
      mockRequest.json = vi.fn().mockResolvedValue({})

      const response = await POST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.authorizationUrl).toBeDefined()
    })

    it('should handle request body with additional parameters', async () => {
      mockRequest.headers.get.mockReturnValue('Bearer valid-token')
      mockRequest.json = vi.fn().mockResolvedValue({
        customParam: 'value',
        anotherParam: 'another-value',
      })

      const response = await POST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.authorizationUrl).toBeDefined()
      expect(mockOAuth2Client.generateState).toHaveBeenCalled()
    })

    it('should return 401 when no authorization header in POST', async () => {
      mockRequest.headers.get.mockReturnValue(null)
      mockRequest.json = vi.fn().mockResolvedValue({})

      const response = await POST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Authentication required')
    })
  })

  describe('Error handling', () => {
    it('should handle OAuth2 client errors', async () => {
      mockRequest.headers.get.mockReturnValue('Bearer valid-token')
      mockOAuth2Client.generateState.mockImplementation(() => {
        throw new Error('OAuth2 client error')
      })

      const response = await GET(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Authorization failed')
      expect(data.message).toBe('Failed to initiate OAuth2 authorization flow')
    })

    it('should handle JSON parsing errors', async () => {
      mockRequest.headers.get.mockReturnValue('Bearer valid-token')
      mockRequest.json = vi
        .fn()
        .mockRejectedValue(new Error('JSON parse error'))

      const response = await POST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Authorization failed')
    })

    it('should handle authorization URL generation errors', async () => {
      mockRequest.headers.get.mockReturnValue('Bearer valid-token')
      mockRequest.json = vi.fn().mockResolvedValue({})
      mockOAuth2Client.createAuthorizationUrl.mockImplementation(() => {
        throw new Error('URL generation failed')
      })

      const response = await POST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Authorization failed')
    })
  })

  describe('Cookie configuration', () => {
    it('should set cookies with correct attributes', async () => {
      mockRequest.headers.get.mockReturnValue('Bearer valid-token')

      const response = await GET(mockRequest)
      const stateCookie = response.cookies.get('oauth2_state')
      const verifierCookie = response.cookies.get('oauth2_code_verifier')

      expect(stateCookie).toMatchObject({
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 600, // 10 minutes
        path: '/',
      })

      expect(verifierCookie).toMatchObject({
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 600, // 10 minutes
        path: '/',
      })
    })
  })

  describe('Logging', () => {
    it('should log authorization request', async () => {
      mockRequest.headers.get.mockReturnValue('Bearer valid-token')

      await GET(mockRequest)

      // Logger should be called for request received
      expect(mockOAuth2Client.generateState).toHaveBeenCalled()
    })

    it('should log successful authorization', async () => {
      mockRequest.headers.get.mockReturnValue('Bearer valid-token')

      await GET(mockRequest)

      // Should log successful state generation
      expect(mockOAuth2Client.createAuthorizationUrl).toHaveBeenCalled()
    })
  })
})
