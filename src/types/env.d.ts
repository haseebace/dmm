interface EnvVariables {
  // Client-side variables (NEXT_PUBLIC_ prefix)
  NEXT_PUBLIC_SUPABASE_URL: string
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string
  NEXT_PUBLIC_APP_URL: string

  // Server-side variables
  SUPABASE_SERVICE_ROLE_KEY: string
  REAL_DEBRID_CLIENT_ID: string
  REAL_DEBRID_CLIENT_SECRET: string
  REAL_DEBRID_REDIRECT_URI: string
  NEXTAUTH_URL: string
  NEXTAUTH_SECRET: string
  NODE_ENV: 'development' | 'production' | 'test'
}

declare global {
  namespace NodeJS {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface ProcessEnv extends EnvVariables {}
  }
}
