import { env } from './env-validation'
import { logger } from './logger'

export const config = {
  // Environment
  env: env.NODE_ENV,
  isDevelopment: env.NODE_ENV === 'development',
  isProduction: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',

  // URLs
  appUrl: env.NEXT_PUBLIC_APP_URL,
  supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,

  // Real-Debrid
  realDebrid: {
    clientId: env.REAL_DEBRID_CLIENT_ID,
    clientSecret: env.REAL_DEBRID_CLIENT_SECRET,
    redirectUri: env.REAL_DEBRID_REDIRECT_URI,
  },

  // NextAuth
  nextAuth: {
    url: env.NEXTAUTH_URL,
    secret: env.NEXTAUTH_SECRET,
  },

  // Supabase keys (server-side only)
  supabase: {
    anonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  },

  // Feature flags
  features: {
    analytics: env.NODE_ENV === 'production',
    logging: true,
    errorReporting: env.NODE_ENV === 'production',
  },
}

// Validate critical configuration on startup
export function validateConfig() {
  logger.info('Validating configuration...', 'config')

  const start = performance.now()

  try {
    // Test Supabase URL format
    new URL(config.supabaseUrl)

    // Test App URL format
    new URL(config.appUrl)

    // Test NextAuth URL format
    new URL(config.nextAuth.url)

    // Test Real-Debrid redirect URI format
    new URL(config.realDebrid.redirectUri)

    // Validate required environment variables
    if (!config.supabase.anonKey) {
      throw new Error('Supabase anonymous key is missing')
    }

    if (!config.supabase.serviceRoleKey) {
      throw new Error('Supabase service role key is missing')
    }

    if (!config.realDebrid.clientId) {
      throw new Error('Real-Debrid client ID is missing')
    }

    if (!config.realDebrid.clientSecret) {
      throw new Error('Real-Debrid client secret is missing')
    }

    if (config.nextAuth.secret.length < 32) {
      throw new Error('NextAuth secret must be at least 32 characters')
    }

    const duration = performance.now() - start
    logger.performance('Configuration validation', duration, {
      status: 'success',
    })

    logger.info('Configuration validation completed successfully', 'config')
    return true
  } catch (error) {
    const duration = performance.now() - start
    logger.performance('Configuration validation', duration, {
      status: 'failed',
    })

    logger.error(
      `Configuration validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'config'
    )
    throw error
  }
}

// Export individual sections for convenience
export { env } from './env-validation'
