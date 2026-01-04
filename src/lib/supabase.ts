import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Check if environment variables are missing or still have placeholder values
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file'
  )
}

if (supabaseUrl === 'your-project-url' || supabaseAnonKey === 'your-anon-key') {
  throw new Error(
    'Supabase environment variables are still set to placeholder values. Please update your .env file with your actual Supabase project URL and anon key from your Supabase dashboard (Settings → API)'
  )
}

// Validate URL format
try {
  new URL(supabaseUrl)
} catch {
  throw new Error(
    `Invalid Supabase URL format: "${supabaseUrl}". Must be a valid HTTP or HTTPS URL (e.g., https://your-project.supabase.co)`
  )
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)