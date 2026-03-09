import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://zspyhtcyapkwyphhfdwy.supabase.co'
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY || 'sb_publishable_gByzlgFKT1CqNm6fFPJhxA_hOhrcg8D'

export const supabase = createClient(supabaseUrl, supabaseKey)
