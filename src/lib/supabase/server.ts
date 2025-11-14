import { createClient } from '@supabase/supabase-js'
import { env } from '../env-validation'

export function createServerClient() {
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      db: {
        schema: 'public',
      },
    }
  )
}

export const supabaseServer = createServerClient()
