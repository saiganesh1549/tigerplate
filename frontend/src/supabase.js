import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hnxovyhnzrnvjvapkhwi.supabase.co'
const supabaseKey = 'sb_publishable_Gh3MeoNC5Gw9AKg2Ab4bug_kpqB9ZTx'

export const supabase = createClient(supabaseUrl, supabaseKey)
