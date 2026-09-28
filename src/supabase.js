import { createClient } from "@supabase/supabase-js";

// Paste values from Supabase > Project Settings > API
export const supabase = createClient(
  "https://ptusejmaedyzjojuuzau.supabase.co",
  "sb_publishable_mmB80W0mUpwaeKYOLwB2Ww_QvD0aDPG"
);
