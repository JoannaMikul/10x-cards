import { createClient } from "@supabase/supabase-js";

import type { Database } from "../db/database.types.ts";

const supabaseUrl = import.meta.env.SUPABASE_URL;
const supabaseAnonKey = import.meta.env.SUPABASE_KEY;
export const supabaseClient = createClient<Database>(supabaseUrl, supabaseAnonKey);
const supabaseServiceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
export const supabaseServiceClient = createClient<Database>(supabaseUrl, supabaseServiceRoleKey || supabaseAnonKey);

export type SupabaseClient = typeof supabaseClient;

export const DEFAULT_USER_ID = "49e6ead8-c0d5-4747-8b8b-e70d650263b7";
