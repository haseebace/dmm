import { NextRequest, NextResponse } from 'next/server'
import { oauth2Client } from '@/lib/oauth2/client'
import { oauth2TokenStorage } from '@/lib/oauth2/token-storage'
import { logger } from '@/lib/logger'

/**
 * OAuth2 Revocation Endpoint
 * Handles revocation of OAuth2 tokens and user deauthentication
 */
export async function POST(request: NextRequest) {
  try {
    logger.info('OAuth2 revocation request received', 'oauth2')

    // Get current user from Supabase
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // For now, we'll assume the token is valid and proceed
    // In a real implementation, you'd validate the token and get user info
    const token = authHeader.substring(7)

    // Get user tokens from storage
    const user = await oauth2TokenStorage.getUserFromTokens()
    if (!user) {
      logger.warn('No authenticated user found for revocation', 'oauth2')
      return NextResponse.json(
        { error: 'No authenticated session found' },
        { status: 401 }
      )
    }

    // Get stored tokens
    const storedTokens = await oauth2TokenStorage.getTokens(user.id)
    if (!storedTokens) {
      logger.warn('No stored tokens found for user', 'oauth2', {
        userId: user.id,
      })
      return NextResponse.json(
        { error: 'No OAuth2 tokens found' },
        { status: 404 }
      )
    }

    // Revoke the access token with Real-Debrid
    try {
      await oauth2Client.revokeToken(storedTokens.accessToken)
      logger.info('Successfully revoked token with Real-Debrid', 'oauth2', {
        userId: user.id,
      })
    } catch (revokeError) {
      // Log the error but continue with local cleanup
      logger.warn('Failed to revoke token with Real-Debrid', 'oauth2', {
        userId: user.id,
        error:
          revokeError instanceof Error ? revokeError.message : 'Unknown error',
      })
    }

    // Remove refresh token if it exists
    if (storedTokens.refreshToken) {
      try {
        await oauth2Client.revokeToken(storedTokens.refreshToken)
        logger.info(
          'Successfully revoked refresh token with Real-Debrid',
          'oauth2',
          {
            userId: user.id,
          }
        )
      } catch (refreshError) {
        logger.warn(
          'Failed to revoke refresh token with Real-Debrid',
          'oauth2',
          {
            userId: user.id,
            error:
              refreshError instanceof Error
                ? refreshError.message
                : 'Unknown error',
          }
        )
      }
    }

    // Delete tokens from local storage
    await oauth2TokenStorage.deleteTokens(user.id)

    logger.info('OAuth2 tokens revoked successfully', 'oauth2', {
      userId: user.id,
      username: user.username,
    })

    // Create response
    const response = NextResponse.json({
      success: true,
      message: 'Successfully revoked OAuth2 tokens and logged out',
      user: {
        id: user.id,
        username: user.username,
      },
    })

    // Clear authentication cookies
    response.cookies.set('oauth2_authenticated', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    })

    // Clear any other auth-related cookies
    response.cookies.set('next-auth.session-token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    })

    return response
  } catch (error) {
    logger.error('OAuth2 revocation failed', 'oauth2', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    })

    return NextResponse.json(
      {
        success: false,
        error: 'Revocation failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * Handle GET requests for revocation status
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        {
          authenticated: false,
          message: 'No authentication provided',
        },
        { status: 200 }
      )
    }

    // Check if user has OAuth2 tokens
    const user = await oauth2TokenStorage.getUserFromTokens()

    return NextResponse.json({
      authenticated: !!user,
      user: user
        ? {
            id: user.id,
            username: user.username,
            premium: user.premium,
          }
        : null,
    })
  } catch (error) {
    logger.error('OAuth2 status check failed', 'oauth2', {
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    return NextResponse.json(
      {
        authenticated: false,
        error: 'Status check failed',
      },
      { status: 500 }
    )
  }
}
