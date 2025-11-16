import { NextRequest, NextResponse } from 'next/server'
import { oauth2Client, OAuth2State } from '@/lib/oauth2/client'
import { oauth2TokenStorage } from '@/lib/oauth2/token-storage'
import { logger } from '@/lib/logger'
import { OAuth2Error } from '@/lib/error-handler'

/**
 * OAuth2 Callback Endpoint
 * Handles the callback from Real-Debrid after user authorization
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')
    const errorDescription = searchParams.get('error_description')

    logger.info('OAuth2 callback received', 'oauth2', {
      hasCode: !!code,
      hasState: !!state,
      hasError: !!error,
    })

    // Handle OAuth2 errors
    if (error) {
      logger.error('OAuth2 authorization error', 'oauth2', {
        error,
        errorDescription,
      })

      const errorResponse = NextResponse.redirect(
        `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}?error=${encodeURIComponent(error)}&description=${encodeURIComponent(errorDescription || '')}`
      )

      // Clear OAuth2 cookies
      clearOAuth2Cookies(errorResponse)

      return errorResponse
    }

    // Validate required parameters
    if (!code || !state) {
      logger.error('Missing required OAuth2 parameters', 'oauth2', {
        hasCode: !!code,
        hasState: !!state,
      })

      const errorResponse = NextResponse.redirect(
        `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}?error=invalid_request&description=Missing required parameters`
      )

      clearOAuth2Cookies(errorResponse)
      return errorResponse
    }

    // Get stored state and code verifier from cookies
    const storedState = request.cookies.get('oauth2_state')?.value
    const codeVerifier = request.cookies.get('oauth2_code_verifier')?.value

    // Validate state to prevent CSRF
    if (!storedState || storedState !== state) {
      logger.error('Invalid OAuth2 state', 'oauth2', {
        providedState: state.substring(0, 8) + '...',
        storedState: storedState?.substring(0, 8) + '...',
      })

      const errorResponse = NextResponse.redirect(
        `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}?error=invalid_state&description=Invalid OAuth2 state`
      )

      clearOAuth2Cookies(errorResponse)
      return errorResponse
    }

    if (!codeVerifier) {
      logger.error('Missing code verifier', 'oauth2')

      const errorResponse = NextResponse.redirect(
        `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}?error=missing_verifier&description=Missing PKCE code verifier`
      )

      clearOAuth2Cookies(errorResponse)
      return errorResponse
    }

    // Exchange authorization code for tokens
    const oauth2State: OAuth2State = {
      state,
      codeVerifier,
      codeChallenge: '', // Not needed for token exchange
      redirectUri: oauth2Client['redirectUri'],
      createdAt: Date.now(),
    }

    const tokens = await oauth2Client.exchangeCodeForTokens(code, oauth2State)

    // Get user information from Real-Debrid
    const userInfo = await oauth2Client.getUserInfo(tokens.accessToken)

    // Get current user from Supabase to map to OAuth2 tokens
    // In a real implementation, you'd have a proper user mapping
    // For now, we'll use the Real-Debrid user ID as the identifier
    const userId = userInfo.id

    // Store tokens securely
    await oauth2TokenStorage.storeTokens(userId, tokens)

    logger.info('OAuth2 authentication successful', 'oauth2', {
      userId,
      username: userInfo.username,
      hasRefreshToken: !!tokens.refreshToken,
    })

    // Create success response with user info
    const successResponse = NextResponse.redirect(
      `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}?success=true&user=${encodeURIComponent(userInfo.username)}`
    )

    // Clear OAuth2 cookies
    clearOAuth2Cookies(successResponse)

    // Set user session cookie (optional - you might use Supabase auth instead)
    successResponse.cookies.set('oauth2_authenticated', 'true', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: tokens.expiresIn,
      path: '/',
    })

    return successResponse
  } catch (error) {
    logger.error('OAuth2 callback error', 'oauth2', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    })

    const errorResponse = NextResponse.redirect(
      `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}?error=server_error&description=${encodeURIComponent('Authentication failed')}`
    )

    clearOAuth2Cookies(errorResponse)
    return errorResponse
  }
}

/**
 * Handle POST requests for OAuth2 callback
 * Alternative endpoint that returns JSON instead of redirecting
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { code, state, error, errorDescription } = body

    logger.info('OAuth2 callback POST received', 'oauth2', {
      hasCode: !!code,
      hasState: !!state,
      hasError: !!error,
    })

    // Handle OAuth2 errors
    if (error) {
      throw new OAuth2Error(
        errorDescription || `OAuth2 authorization failed: ${error}`,
        400
      )
    }

    // Validate required parameters
    if (!code || !state) {
      throw new OAuth2Error('Missing required OAuth2 parameters', 400)
    }

    // Get stored state and code verifier from cookies
    const storedState = request.cookies.get('oauth2_state')?.value
    const codeVerifier = request.cookies.get('oauth2_code_verifier')?.value

    // Validate state to prevent CSRF
    if (!storedState || storedState !== state) {
      throw new OAuth2Error('Invalid OAuth2 state', 400)
    }

    if (!codeVerifier) {
      throw new OAuth2Error('Missing PKCE code verifier', 400)
    }

    // Exchange authorization code for tokens
    const oauth2State: OAuth2State = {
      state,
      codeVerifier,
      codeChallenge: '',
      redirectUri: oauth2Client['redirectUri'],
      createdAt: Date.now(),
    }

    const tokens = await oauth2Client.exchangeCodeForTokens(code, oauth2State)

    // Get user information
    const userInfo = await oauth2Client.getUserInfo(tokens.accessToken)

    // Store tokens
    await oauth2TokenStorage.storeTokens(userInfo.id, tokens)

    logger.info('OAuth2 authentication successful (POST)', 'oauth2', {
      userId: userInfo.id,
      username: userInfo.username,
    })

    // Clear OAuth2 cookies
    const response = NextResponse.json({
      success: true,
      user: userInfo,
      message: 'Authentication successful',
    })

    clearOAuth2Cookies(response)

    return response
  } catch (error) {
    logger.error('OAuth2 callback POST error', 'oauth2', {
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    const response = NextResponse.json(
      {
        success: false,
        error: 'Authentication failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )

    clearOAuth2Cookies(response)
    return response
  }
}

/**
 * Clear OAuth2 cookies
 */
function clearOAuth2Cookies(response: NextResponse) {
  response.cookies.set('oauth2_state', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  })

  response.cookies.set('oauth2_code_verifier', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  })
}
