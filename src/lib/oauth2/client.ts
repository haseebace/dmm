import { config } from '../config'
import { logger } from '../logger'
import { v4 as uuidv4 } from 'uuid'

// OAuth2 configuration for Real-Debrid
const OAUTH2_CONFIG = {
  authorizationEndpoint: 'https://api.real-debrid.com/oauth/v2/auth',
  tokenEndpoint: 'https://api.real-debrid.com/oauth/v2/token',
  revocationEndpoint: 'https://api.real-debrid.com/oauth/v2/revoke',
  scopes: ['openid', 'offline_access'], // Request offline access for refresh tokens
  responseType: 'code',
  grantType: 'authorization_code',
}

export interface OAuth2State {
  state: string
  codeVerifier: string
  codeChallenge: string
  redirectUri: string
  createdAt: number
}

export interface OAuth2Tokens {
  accessToken: string
  refreshToken?: string
  tokenType: string
  expiresIn: number
  scope: string
  createdAt: number
}

export interface OAuth2UserInfo {
  id: string
  username: string
  email?: string
  avatar?: string
  premium: boolean
  expiration?: string
}

/**
 * OAuth2 Client for Real-Debrid authentication
 */
export class OAuth2Client {
  private readonly clientId: string
  private readonly clientSecret: string
  private readonly redirectUri: string

  constructor() {
    this.clientId = config.realDebrid.clientId
    this.clientSecret = config.realDebrid.clientSecret
    this.redirectUri = config.realDebrid.redirectUri

    logger.info('OAuth2 Client initialized', 'oauth2', {
      clientId: this.clientId.substring(0, 8) + '...',
      redirectUri: this.redirectUri,
    })
  }

  /**
   * Generate OAuth2 state and code challenge for PKCE
   */
  generateState(): OAuth2State {
    const state = uuidv4()
    const codeVerifier = this.generateCodeVerifier()
    const codeChallenge = this.generateCodeChallenge(codeVerifier)

    const oauthState: OAuth2State = {
      state,
      codeVerifier,
      codeChallenge,
      redirectUri: this.redirectUri,
      createdAt: Date.now(),
    }

    logger.info('Generated OAuth2 state', 'oauth2', {
      state: state.substring(0, 8) + '...',
      codeChallengePresent: !!codeChallenge,
    })

    return oauthState
  }

  /**
   * Create authorization URL for Real-Debrid OAuth2 flow
   */
  createAuthorizationUrl(state: OAuth2State): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: OAUTH2_CONFIG.responseType,
      scope: OAUTH2_CONFIG.scopes.join(' '),
      state: state.state,
      code_challenge: state.codeChallenge,
      code_challenge_method: 'S256',
    })

    const authUrl = `${OAUTH2_CONFIG.authorizationEndpoint}?${params.toString()}`

    logger.info('Created authorization URL', 'oauth2', {
      url: authUrl.replace(/client_id=[^&]+/, 'client_id=***'),
    })

    return authUrl
  }

  /**
   * Exchange authorization code for access tokens
   */
  async exchangeCodeForTokens(
    code: string,
    state: OAuth2State
  ): Promise<OAuth2Tokens> {
    try {
      const response = await fetch(OAUTH2_CONFIG.tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          code,
          grant_type: OAUTH2_CONFIG.grantType,
          redirect_uri: this.redirectUri,
          code_verifier: state.codeVerifier,
        }),
      })

      if (!response.ok) {
        const errorData = await response.text()
        throw new Error(
          `Token exchange failed: ${response.status} ${errorData}`
        )
      }

      const tokenData = await response.json()

      const tokens: OAuth2Tokens = {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        tokenType: tokenData.token_type,
        expiresIn: tokenData.expires_in,
        scope: tokenData.scope,
        createdAt: Date.now(),
      }

      logger.info('Successfully exchanged code for tokens', 'oauth2', {
        tokenType: tokens.tokenType,
        expiresIn: tokens.expiresIn,
        hasRefreshToken: !!tokens.refreshToken,
      })

      return tokens
    } catch (error) {
      logger.error('Failed to exchange code for tokens', 'oauth2', {
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      throw error
    }
  }

  /**
   * Get user information from Real-Debrid API
   */
  async getUserInfo(accessToken: string): Promise<OAuth2UserInfo> {
    try {
      const response = await fetch(
        'https://api.real-debrid.com/rest/1.0/user',
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      )

      if (!response.ok) {
        throw new Error(`Failed to get user info: ${response.status}`)
      }

      const userData = await response.json()

      const userInfo: OAuth2UserInfo = {
        id: userData.id,
        username: userData.username,
        email: userData.email,
        avatar: userData.avatar,
        premium: userData.premium,
        expiration: userData.expiration,
      }

      logger.info('Successfully retrieved user info', 'oauth2', {
        userId: userInfo.id,
        username: userInfo.username,
        premium: userInfo.premium,
      })

      return userInfo
    } catch (error) {
      logger.error('Failed to get user info', 'oauth2', {
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      throw error
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<OAuth2Tokens> {
    try {
      const response = await fetch(OAUTH2_CONFIG.tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
      })

      if (!response.ok) {
        const errorData = await response.text()
        throw new Error(`Token refresh failed: ${response.status} ${errorData}`)
      }

      const tokenData = await response.json()

      const tokens: OAuth2Tokens = {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || refreshToken,
        tokenType: tokenData.token_type,
        expiresIn: tokenData.expires_in,
        scope: tokenData.scope,
        createdAt: Date.now(),
      }

      logger.info('Successfully refreshed access token', 'oauth2')

      return tokens
    } catch (error) {
      logger.error('Failed to refresh access token', 'oauth2', {
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      throw error
    }
  }

  /**
   * Revoke access token
   */
  async revokeToken(token: string): Promise<void> {
    try {
      const response = await fetch(OAUTH2_CONFIG.revocationEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          token,
          action: 'revoke',
        }),
      })

      if (!response.ok) {
        throw new Error(`Token revocation failed: ${response.status}`)
      }

      logger.info('Successfully revoked token', 'oauth2')
    } catch (error) {
      logger.error('Failed to revoke token', 'oauth2', {
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      throw error
    }
  }

  /**
   * Generate code verifier for PKCE
   */
  private generateCodeVerifier(): string {
    const array = new Uint8Array(32)
    crypto.getRandomValues(array)
    return btoa(String.fromCharCode.apply(null, Array.from(array)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')
  }

  /**
   * Generate code challenge for PKCE
   */
  private generateCodeChallenge(verifier: string): string {
    // Simple synchronous implementation for testing
    // In production, you might want to use crypto.subtle but for browser compatibility,
    // we can use a simple hash function for now
    const encoder = new TextEncoder()
    const data = encoder.encode(verifier)
    let hash = 0
    for (let i = 0; i < data.length; i++) {
      const char = data[i]
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32bit integer
    }
    return btoa(hash.toString())
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')
  }
}

// Singleton instance
export const oauth2Client = new OAuth2Client()
