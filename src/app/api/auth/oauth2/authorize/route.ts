import { NextRequest, NextResponse } from 'next/server'
import { oauth2Client } from '@/lib/oauth2/client'
import { logger } from '@/lib/logger'

/**
 * OAuth2 Authorization Endpoint
 * Initiates the OAuth2 flow with Real-Debrid
 */
export async function GET(request: NextRequest) {
  try {
    logger.info('OAuth2 authorization request received', 'oauth2')

    // Get current user from Supabase
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // In a real implementation, you'd validate this token with Supabase
    // For now, we'll proceed with the flow

    // Generate OAuth2 state
    const state = await oauth2Client.generateState()

    // Store state in session/cookie for validation during callback
    const response = NextResponse.json({
      authorizationUrl: oauth2Client.createAuthorizationUrl(state),
      state: state.state,
    })

    // Set secure HTTP-only cookie with state for CSRF protection
    response.cookies.set('oauth2_state', state.state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 10 * 60, // 10 minutes
      path: '/',
    })

    // Store code verifier in session (you might want to use a proper session store)
    response.cookies.set('oauth2_code_verifier', state.codeVerifier, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 10 * 60, // 10 minutes
      path: '/',
    })

    logger.info('OAuth2 authorization initiated', 'oauth2', {
      state: state.state.substring(0, 8) + '...',
      authorizationUrlProvided: true,
    })

    return response
  } catch (error) {
    logger.error('OAuth2 authorization failed', 'oauth2', {
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    return NextResponse.json(
      {
        error: 'Authorization failed',
        message: 'Failed to initiate OAuth2 authorization flow',
      },
      { status: 500 }
    )
  }
}

/**
 * Handle POST requests for OAuth2 authorization
 * Alternative endpoint that can accept additional parameters
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    logger.info('OAuth2 authorization POST request', 'oauth2', {
      hasBody: !!body,
    })

    // Get current user
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Generate OAuth2 state
    const state = await oauth2Client.generateState()

    // Create authorization URL
    const authorizationUrl = oauth2Client.createAuthorizationUrl(state)

    // Store state for callback validation
    const response = NextResponse.json({
      authorizationUrl,
      state: state.state,
      message: 'OAuth2 authorization initiated',
    })

    // Set secure cookies
    response.cookies.set('oauth2_state', state.state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 10 * 60,
      path: '/',
    })

    response.cookies.set('oauth2_code_verifier', state.codeVerifier, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 10 * 60,
      path: '/',
    })

    logger.info('OAuth2 authorization POST completed', 'oauth2', {
      state: state.state.substring(0, 8) + '...',
    })

    return response
  } catch (error) {
    logger.error('OAuth2 authorization POST failed', 'oauth2', {
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    return NextResponse.json(
      {
        error: 'Authorization failed',
        message: 'Failed to initiate OAuth2 authorization flow',
      },
      { status: 500 }
    )
  }
}
