import { createClient } from '@supabase/supabase-js';

// Keep only printable ASCII: pasted keys sometimes carry hidden characters.
const clean = (v: string | undefined) => (v || '').replace(/[^\x21-\x7E]/g, '');
export const SUPABASE_URL = clean(import.meta.env.VITE_SUPABASE_URL);
const anonKey = clean(import.meta.env.VITE_SUPABASE_ANON_KEY);

export const isConfigured = Boolean(SUPABASE_URL && anonKey);
export const supabase = createClient(SUPABASE_URL || 'https://not-configured.supabase.co', anonKey || 'not-configured');
