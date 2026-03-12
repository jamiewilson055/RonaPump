import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://zspyhtcyapkwyphhfdwy.supabase.co'
const supabaseKey = 'sb_publishable_gByzlgFKT1CqNm6fFPJhxA_hOhrcg8D'

export const supabase = createClient(supabaseUrl, supabaseKey)
