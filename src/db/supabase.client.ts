import { createClient } from "@supabase/supabase-js";

import type { Database } from "../db/database.types.ts";

const supabaseUrl = import.meta.env.SUPABASE_URL;
const supabaseAnonKey = import.meta.env.SUPABASE_KEY;
export const supabaseClient = createClient<Database>(supabaseUrl, supabaseAnonKey);
const supabaseServiceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
export const supabaseServiceClient = createClient<Database>(supabaseUrl, supabaseServiceRoleKey || supabaseAnonKey);

export type SupabaseClient = typeof supabaseClient;

export const DEFAULT_USER_ID = "45d37d04-81c5-46eb-911c-051d729c5dc8";
