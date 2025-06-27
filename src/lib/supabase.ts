import { createClient } from "@supabase/supabase-js";
import { env } from "@/env.mjs";

// Supabase client for client-side operations
export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);

// Supabase client with service role for server-side operations
export const supabaseAdmin = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// Database types will be generated here later
export type Database = {
  public: {
    Tables: {
      exercises: {
        Row: {
          id: string;
          name: string;
          muscle_group:
            | "chest"
            | "back"
            | "shoulders"
            | "arms"
            | "legs"
            | "core";
          equipment: string | null;
          is_custom: boolean;
          user_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          muscle_group:
            | "chest"
            | "back"
            | "shoulders"
            | "arms"
            | "legs"
            | "core";
          equipment?: string | null;
          is_custom?: boolean;
          user_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          muscle_group?:
            | "chest"
            | "back"
            | "shoulders"
            | "arms"
            | "legs"
            | "core";
          equipment?: string | null;
          is_custom?: boolean;
          user_id?: string | null;
          created_at?: string;
        };
      };
      workout_templates: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          day_number: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          day_number: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          day_number?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      template_exercises: {
        Row: {
          id: string;
          template_id: string;
          exercise_id: string;
          order_index: number;
          sets: number;
          reps_min: number;
          reps_max: number;
          rpe_target: number | null;
        };
        Insert: {
          id?: string;
          template_id: string;
          exercise_id: string;
          order_index: number;
          sets: number;
          reps_min: number;
          reps_max: number;
          rpe_target?: number | null;
        };
        Update: {
          id?: string;
          template_id?: string;
          exercise_id?: string;
          order_index?: number;
          sets?: number;
          reps_min?: number;
          reps_max?: number;
          rpe_target?: number | null;
        };
      };
      workout_sessions: {
        Row: {
          id: string;
          user_id: string;
          template_id: string;
          start_time: string;
          end_time: string | null;
          duration_minutes: number | null;
          completed: boolean;
        };
        Insert: {
          id?: string;
          user_id: string;
          template_id: string;
          start_time?: string;
          end_time?: string | null;
          duration_minutes?: number | null;
          completed?: boolean;
        };
        Update: {
          id?: string;
          user_id?: string;
          template_id?: string;
          start_time?: string;
          end_time?: string | null;
          duration_minutes?: number | null;
          completed?: boolean;
        };
      };
      session_exercises: {
        Row: {
          id: string;
          session_id: string;
          exercise_id: string;
          order_index: number;
        };
        Insert: {
          id?: string;
          session_id: string;
          exercise_id: string;
          order_index: number;
        };
        Update: {
          id?: string;
          session_id?: string;
          exercise_id?: string;
          order_index?: number;
        };
      };
      session_sets: {
        Row: {
          id: string;
          session_exercise_id: string;
          set_number: number;
          weight: number;
          reps: number;
          rpe: number | null;
          completed: boolean;
        };
        Insert: {
          id?: string;
          session_exercise_id: string;
          set_number: number;
          weight: number;
          reps: number;
          rpe?: number | null;
          completed?: boolean;
        };
        Update: {
          id?: string;
          session_exercise_id?: string;
          set_number?: number;
          weight?: number;
          reps?: number;
          rpe?: number | null;
          completed?: boolean;
        };
      };
      body_weight_logs: {
        Row: {
          id: string;
          user_id: string;
          weight: number;
          unit: "kg" | "lbs";
          logged_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          weight: number;
          unit?: "kg" | "lbs";
          logged_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          weight?: number;
          unit?: "kg" | "lbs";
          logged_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      muscle_group: "chest" | "back" | "shoulders" | "arms" | "legs" | "core";
      weight_unit: "kg" | "lbs";
    };
  };
};
