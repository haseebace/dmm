import { z } from 'zod'

const envSchema = z.object({
  // Client-side
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().min(1, 'Supabase URL is required'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(1, 'Supabase anonymous key is required'),
  NEXT_PUBLIC_APP_URL: z.string().url().min(1, 'App URL is required'),

  // Server-side
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, 'Supabase service role key is required'),
  REAL_DEBRID_CLIENT_ID: z.string().min(1, 'Real-Debrid client ID is required'),
  REAL_DEBRID_CLIENT_SECRET: z
    .string()
    .min(1, 'Real-Debrid client secret is required'),
  REAL_DEBRID_REDIRECT_URI: z
    .string()
    .url()
    .min(1, 'Real-Debrid redirect URI is required'),
  NEXTAUTH_URL: z.string().url().min(1, 'NextAuth URL is required'),
  NEXTAUTH_SECRET: z
    .string()
    .min(32, 'NextAuth secret must be at least 32 characters'),

  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
})

export function validateEnv() {
  try {
    return envSchema.parse(process.env)
  } catch (error) {
    console.error('❌ Invalid environment variables:', error)
    if (error instanceof z.ZodError) {
      console.error('Validation errors:')
      error.issues.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`)
      })
    }
    throw new Error(
      'Environment validation failed. Please check your .env.local file.'
    )
  }
}

export const env = validateEnv()
