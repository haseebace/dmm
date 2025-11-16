import { supabaseClient } from '../supabase/client'
import { logger } from '../logger'
import { OAuth2Tokens, OAuth2UserInfo } from '../../types/oauth2'

export interface StoredOAuth2Tokens extends OAuth2Tokens {
  user_id: string
  id: string
  created_at: string
  updated_at: string
}

/**
 * OAuth2 Token Storage Service
 * Manages secure storage and retrieval of OAuth2 tokens in Supabase
 */
export class OAuth2TokenStorage {
  /**
   * Store OAuth2 tokens for a user
   */
  async storeTokens(userId: string, tokens: OAuth2Tokens): Promise<void> {
    try {
      const { error } = await supabaseClient.from('oauth_tokens').upsert(
        {
          user_id: userId,
          access_token: tokens.accessToken,
          refresh_token: tokens.refreshToken || null,
          token_type: tokens.tokenType,
          expires_in: tokens.expiresIn,
          scope: tokens.scope,
          created_at: new Date(tokens.createdAt).toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id',
        }
      )

      if (error) {
        throw new Error(`Failed to store tokens: ${error.message}`)
      }

      logger.info('Successfully stored OAuth2 tokens', 'oauth2', {
        userId,
        tokenType: tokens.tokenType,
        expiresIn: tokens.expiresIn,
        hasRefreshToken: !!tokens.refreshToken,
      })
    } catch (error) {
      logger.error('Failed to store OAuth2 tokens', 'oauth2', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      throw error
    }
  }

  /**
   * Retrieve OAuth2 tokens for a user
   */
  async getTokens(userId: string): Promise<OAuth2Tokens | null> {
    try {
      const { data, error } = await supabaseClient
        .from('oauth_tokens')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows found
          return null
        }
        throw new Error(`Failed to retrieve tokens: ${error.message}`)
      }

      if (!data) {
        return null
      }

      const tokens: OAuth2Tokens = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || undefined,
        tokenType: data.token_type,
        expiresIn: data.expires_in,
        scope: data.scope,
        createdAt: new Date(data.created_at).getTime(),
      }

      logger.info('Successfully retrieved OAuth2 tokens', 'oauth2', {
        userId,
        tokenType: tokens.tokenType,
        hasRefreshToken: !!tokens.refreshToken,
      })

      return tokens
    } catch (error) {
      logger.error('Failed to retrieve OAuth2 tokens', 'oauth2', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      throw error
    }
  }

  /**
   * Update OAuth2 tokens for a user
   */
  async updateTokens(
    userId: string,
    tokens: Partial<OAuth2Tokens>
  ): Promise<void> {
    try {
      const updateData: Record<string, string | number> = {
        updated_at: new Date().toISOString(),
      }

      if (tokens.accessToken) updateData.access_token = tokens.accessToken
      if (tokens.refreshToken) updateData.refresh_token = tokens.refreshToken
      if (tokens.tokenType) updateData.token_type = tokens.tokenType
      if (tokens.expiresIn) updateData.expires_in = tokens.expiresIn
      if (tokens.scope) updateData.scope = tokens.scope
      if (tokens.createdAt)
        updateData.created_at = new Date(tokens.createdAt).toISOString()

      const { error } = await supabaseClient
        .from('oauth_tokens')
        .update(updateData)
        .eq('user_id', userId)

      if (error) {
        throw new Error(`Failed to update tokens: ${error.message}`)
      }

      logger.info('Successfully updated OAuth2 tokens', 'oauth2', {
        userId,
        updatedFields: Object.keys(updateData),
      })
    } catch (error) {
      logger.error('Failed to update OAuth2 tokens', 'oauth2', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      throw error
    }
  }

  /**
   * Delete OAuth2 tokens for a user
   */
  async deleteTokens(userId: string): Promise<void> {
    try {
      const { error } = await supabaseClient
        .from('oauth_tokens')
        .delete()
        .eq('user_id', userId)

      if (error) {
        throw new Error(`Failed to delete tokens: ${error.message}`)
      }

      logger.info('Successfully deleted OAuth2 tokens', 'oauth2', {
        userId,
      })
    } catch (error) {
      logger.error('Failed to delete OAuth2 tokens', 'oauth2', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      throw error
    }
  }

  /**
   * Check if tokens are expired or will expire soon
   */
  isTokenExpired(tokens: OAuth2Tokens, bufferMinutes: number = 5): boolean {
    const expirationTime = tokens.createdAt + tokens.expiresIn * 1000
    const bufferTime = bufferMinutes * 60 * 1000
    const now = Date.now()

    return now + bufferTime >= expirationTime
  }

  /**
   * Get user from stored tokens if available
   */
  async getUserFromTokens(): Promise<OAuth2UserInfo | null> {
    try {
      // Get current user from Supabase auth
      const {
        data: { user },
        error,
      } = await supabaseClient.auth.getUser()

      if (error || !user) {
        logger.warn('No authenticated user found', 'oauth2')
        return null
      }

      // Get OAuth2 tokens for this user
      const tokens = await this.getTokens(user.id)
      if (!tokens) {
        logger.warn('No OAuth2 tokens found for user', 'oauth2', {
          userId: user.id,
        })
        return null
      }

      // Check if tokens are expired
      if (this.isTokenExpired(tokens)) {
        logger.warn('OAuth2 tokens are expired', 'oauth2', {
          userId: user.id,
        })
        return null
      }

      // Get user info from Real-Debrid API
      // This would be implemented when we have the API client
      // For now, return basic user info
      const userInfo: OAuth2UserInfo = {
        id: user.id,
        username:
          user.user_metadata?.username ||
          user.email?.split('@')[0] ||
          'Unknown',
        email: user.email,
        premium: false, // Will be updated from Real-Debrid API
      }

      logger.info('Retrieved user from stored tokens', 'oauth2', {
        userId: user.id,
        username: userInfo.username,
      })

      return userInfo
    } catch (error) {
      logger.error('Failed to get user from tokens', 'oauth2', {
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      return null
    }
  }
}

// Singleton instance
export const oauth2TokenStorage = new OAuth2TokenStorage()
