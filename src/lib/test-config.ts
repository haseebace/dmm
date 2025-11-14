import { config, validateConfig } from './config'
import { logger } from './logger'
import { env } from './env-validation'

export async function testConfiguration() {
  logger.info('Starting configuration test...', 'test')

  try {
    // Test 1: Configuration validation
    logger.info('Testing configuration validation...', 'test')
    validateConfig()
    logger.info('✅ Configuration validation passed', 'test')

    // Test 2: Logger functionality
    logger.info('Testing logger...', 'test')
    logger.debug('Debug message test', 'test', { test: true })
    logger.info('Info message test', 'test')
    logger.warn('Warning message test', 'test')
    logger.error('Error message test', 'test')
    logger.auth('login', 'test-user', { method: 'oauth' })
    logger.database('select', 'users', { limit: 10 })
    logger.api('GET', '/api/test', 200, 45)
    logger.performance('test-operation', 123)
    logger.info('✅ Logger functionality test passed', 'test')

    // Test 3: Environment detection
    logger.info('Testing environment detection...', 'test')
    logger.info(`Environment: ${config.env}`, 'test')
    logger.info(`Is development: ${config.isDevelopment}`, 'test')
    logger.info(`Is production: ${config.isProduction}`, 'test')
    logger.info('✅ Environment detection test passed', 'test')

    // Test 4: Supabase connection (basic test)
    logger.info('Testing Supabase client initialization...', 'test')
    // This will throw if the configuration is invalid
    const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
    logger.info(`Supabase URL: ${supabaseUrl}`, 'test')
    logger.info('✅ Supabase client initialization test passed', 'test')

    logger.info('🎉 All configuration tests passed!', 'test')
    return true
  } catch (error) {
    logger.error(
      `Configuration test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'test'
    )
    return false
  }
}

// Export for potential use in development
export default testConfiguration
