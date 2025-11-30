export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  graphql_public: {
    Tables: Record<never, never>;
    Views: Record<never, never>;
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
  public: {
    Tables: {
      card_tags: {
        Row: {
          card_id: string;
          created_at: string;
          tag_id: number;
        };
        Insert: {
          card_id: string;
          created_at?: string;
          tag_id: number;
        };
        Update: {
          card_id?: string;
          created_at?: string;
          tag_id?: number;
        };
        Relationships: [
          {
            foreignKeyName: "card_tags_card_id_fkey";
            columns: ["card_id"];
            isOneToOne: false;
            referencedRelation: "flashcards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "card_tags_tag_id_fkey";
            columns: ["tag_id"];
            isOneToOne: false;
            referencedRelation: "tags";
            referencedColumns: ["id"];
          },
        ];
      };
      categories: {
        Row: {
          color: string | null;
          created_at: string;
          description: string | null;
          id: number;
          name: string;
          slug: string;
          updated_at: string;
        };
        Insert: {
          color?: string | null;
          created_at?: string;
          description?: string | null;
          id?: number;
          name: string;
          slug: string;
          updated_at?: string;
        };
        Update: {
          color?: string | null;
          created_at?: string;
          description?: string | null;
          id?: number;
          name?: string;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      flashcards: {
        Row: {
          back: string;
          category_id: number | null;
          content_source_id: number | null;
          created_at: string;
          deleted_at: string | null;
          front: string;
          front_back_fingerprint: string | null;
          id: string;
          metadata: Json | null;
          origin: Database["public"]["Enums"]["card_origin"];
          owner_id: string;
          updated_at: string;
        };
        Insert: {
          back: string;
          category_id?: number | null;
          content_source_id?: number | null;
          created_at?: string;
          deleted_at?: string | null;
          front: string;
          front_back_fingerprint?: string | null;
          id?: string;
          metadata?: Json | null;
          origin: Database["public"]["Enums"]["card_origin"];
          owner_id: string;
          updated_at?: string;
        };
        Update: {
          back?: string;
          category_id?: number | null;
          content_source_id?: number | null;
          created_at?: string;
          deleted_at?: string | null;
          front?: string;
          front_back_fingerprint?: string | null;
          id?: string;
          metadata?: Json | null;
          origin?: Database["public"]["Enums"]["card_origin"];
          owner_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "flashcards_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "flashcards_content_source_id_fkey";
            columns: ["content_source_id"];
            isOneToOne: false;
            referencedRelation: "sources";
            referencedColumns: ["id"];
          },
        ];
      };
      generation_candidates: {
        Row: {
          accepted_card_id: string | null;
          back: string;
          created_at: string;
          front: string;
          front_back_fingerprint: string | null;
          generation_id: string;
          id: string;
          owner_id: string;
          status: Database["public"]["Enums"]["candidate_status"];
          suggested_category_id: number | null;
          suggested_tags: Json | null;
          updated_at: string;
        };
        Insert: {
          accepted_card_id?: string | null;
          back: string;
          created_at?: string;
          front: string;
          front_back_fingerprint?: string | null;
          generation_id: string;
          id?: string;
          owner_id: string;
          status?: Database["public"]["Enums"]["candidate_status"];
          suggested_category_id?: number | null;
          suggested_tags?: Json | null;
          updated_at?: string;
        };
        Update: {
          accepted_card_id?: string | null;
          back?: string;
          created_at?: string;
          front?: string;
          front_back_fingerprint?: string | null;
          generation_id?: string;
          id?: string;
          owner_id?: string;
          status?: Database["public"]["Enums"]["candidate_status"];
          suggested_category_id?: number | null;
          suggested_tags?: Json | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "generation_candidates_accepted_card_id_fkey";
            columns: ["accepted_card_id"];
            isOneToOne: true;
            referencedRelation: "flashcards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "generation_candidates_generation_id_fkey";
            columns: ["generation_id"];
            isOneToOne: false;
            referencedRelation: "generations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "generation_candidates_suggested_category_id_fkey";
            columns: ["suggested_category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      generation_error_logs: {
        Row: {
          created_at: string;
          error_code: string;
          error_message: string;
          id: number;
          model: string;
          source_text_hash: string;
          source_text_length: number;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          error_code: string;
          error_message: string;
          id?: number;
          model: string;
          source_text_hash: string;
          source_text_length: number;
          user_id: string;
        };
        Update: {
          created_at?: string;
          error_code?: string;
          error_message?: string;
          id?: number;
          model?: string;
          source_text_hash?: string;
          source_text_length?: number;
          user_id?: string;
        };
        Relationships: [];
      };
      generations: {
        Row: {
          completed_at: string | null;
          created_at: string;
          error_code: string | null;
          error_message: string | null;
          id: string;
          model: string;
          prompt_tokens: number | null;
          sanitized_input_length: number | null;
          sanitized_input_sha256: string | null;
          sanitized_input_text: string;
          started_at: string | null;
          status: Database["public"]["Enums"]["generation_status"];
          temperature: number | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          error_code?: string | null;
          error_message?: string | null;
          id?: string;
          model: string;
          prompt_tokens?: number | null;
          sanitized_input_length?: number | null;
          sanitized_input_sha256?: string | null;
          sanitized_input_text: string;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["generation_status"];
          temperature?: number | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          error_code?: string | null;
          error_message?: string | null;
          id?: string;
          model?: string;
          prompt_tokens?: number | null;
          sanitized_input_length?: number | null;
          sanitized_input_sha256?: string | null;
          sanitized_input_text?: string;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["generation_status"];
          temperature?: number | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      review_events: {
        Row: {
          card_id: string;
          id: number;
          next_interval_days: number | null;
          outcome: Database["public"]["Enums"]["review_outcome"];
          payload: Json | null;
          prev_interval_days: number | null;
          response_time_ms: number | null;
          reviewed_at: string;
          user_id: string;
          was_learning_step: boolean;
        };
        Insert: {
          card_id: string;
          id?: number;
          next_interval_days?: number | null;
          outcome: Database["public"]["Enums"]["review_outcome"];
          payload?: Json | null;
          prev_interval_days?: number | null;
          response_time_ms?: number | null;
          reviewed_at?: string;
          user_id: string;
          was_learning_step?: boolean;
        };
        Update: {
          card_id?: string;
          id?: number;
          next_interval_days?: number | null;
          outcome?: Database["public"]["Enums"]["review_outcome"];
          payload?: Json | null;
          prev_interval_days?: number | null;
          response_time_ms?: number | null;
          reviewed_at?: string;
          user_id?: string;
          was_learning_step?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "review_events_card_id_fkey";
            columns: ["card_id"];
            isOneToOne: false;
            referencedRelation: "flashcards";
            referencedColumns: ["id"];
          },
        ];
      };
      review_stats: {
        Row: {
          aggregates: Json | null;
          card_id: string;
          consecutive_successes: number;
          last_interval_days: number | null;
          last_outcome: Database["public"]["Enums"]["review_outcome"] | null;
          last_reviewed_at: string | null;
          next_review_at: string | null;
          successes: number;
          total_reviews: number;
          user_id: string;
        };
        Insert: {
          aggregates?: Json | null;
          card_id: string;
          consecutive_successes?: number;
          last_interval_days?: number | null;
          last_outcome?: Database["public"]["Enums"]["review_outcome"] | null;
          last_reviewed_at?: string | null;
          next_review_at?: string | null;
          successes?: number;
          total_reviews?: number;
          user_id: string;
        };
        Update: {
          aggregates?: Json | null;
          card_id?: string;
          consecutive_successes?: number;
          last_interval_days?: number | null;
          last_outcome?: Database["public"]["Enums"]["review_outcome"] | null;
          last_reviewed_at?: string | null;
          next_review_at?: string | null;
          successes?: number;
          total_reviews?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "review_stats_card_id_fkey";
            columns: ["card_id"];
            isOneToOne: false;
            referencedRelation: "flashcards";
            referencedColumns: ["id"];
          },
        ];
      };
      sources: {
        Row: {
          created_at: string;
          description: string | null;
          id: number;
          kind: string;
          name: string;
          slug: string;
          updated_at: string;
          url: string | null;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: number;
          kind: string;
          name: string;
          slug: string;
          updated_at?: string;
          url?: string | null;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: number;
          kind?: string;
          name?: string;
          slug?: string;
          updated_at?: string;
          url?: string | null;
        };
        Relationships: [];
      };
      tags: {
        Row: {
          created_at: string;
          description: string | null;
          id: number;
          name: string;
          slug: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: number;
          name: string;
          slug: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: number;
          name?: string;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          granted_at: string;
          role: string;
          user_id: string;
        };
        Insert: {
          granted_at?: string;
          role: string;
          user_id: string;
        };
        Update: {
          granted_at?: string;
          role?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      is_admin: { Args: never; Returns: boolean };
      normalize_flashcard_text: {
        Args: { back: string; front: string };
        Returns: string;
      };
      show_limit: { Args: never; Returns: number };
      show_trgm: { Args: { "": string }; Returns: string[] };
      unaccent: { Args: { "": string }; Returns: string };
    };
    Enums: {
      candidate_status: "proposed" | "edited" | "accepted" | "rejected";
      card_origin: "ai-full" | "ai-edited" | "manual";
      generation_status: "pending" | "running" | "succeeded" | "failed" | "cancelled";
      review_outcome: "fail" | "hard" | "good" | "easy" | "again";
    };
    CompositeTypes: Record<never, never>;
  };
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      candidate_status: ["proposed", "edited", "accepted", "rejected"],
      card_origin: ["ai-full", "ai-edited", "manual"],
      generation_status: ["pending", "running", "succeeded", "failed", "cancelled"],
      review_outcome: ["fail", "hard", "good", "easy", "again"],
    },
  },
} as const;
