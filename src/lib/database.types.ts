export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      agents: {
        Row: {
          avatar_url: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          model: string
          name: string
          owner_id: string
          provider_id: string | null
          system_prompt: string | null
          temperature: number | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          model?: string
          name: string
          owner_id: string
          provider_id?: string | null
          system_prompt?: string | null
          temperature?: number | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          model?: string
          name?: string
          owner_id?: string
          provider_id?: string | null
          system_prompt?: string | null
          temperature?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "agents_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          agent_id: string | null
          chat_id: string
          completion_tokens: number | null
          content: string
          created_at: string
          duration_ms: number | null
          id: string
          model: string
          prompt_tokens: number | null
          provider: string
          reasoning: string
          role: string
          temperature: number | null
          user_id: string
        }
        Insert: {
          agent_id?: string | null
          chat_id: string
          completion_tokens?: number | null
          content: string
          created_at?: string
          duration_ms?: number | null
          id?: string
          model?: string
          prompt_tokens?: number | null
          provider?: string
          reasoning?: string
          role: string
          temperature?: number | null
          user_id: string
        }
        Update: {
          agent_id?: string | null
          chat_id?: string
          completion_tokens?: number | null
          content?: string
          created_at?: string
          duration_ms?: number | null
          id?: string
          model?: string
          prompt_tokens?: number | null
          provider?: string
          reasoning?: string
          role?: string
          temperature?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_participants: {
        Row: {
          chat_id: string
          created_at: string
          id: string
          participant_id: string
          participant_type: string
        }
        Insert: {
          chat_id: string
          created_at?: string
          id?: string
          participant_id: string
          participant_type: string
        }
        Update: {
          chat_id?: string
          created_at?: string
          id?: string
          participant_id?: string
          participant_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_participants_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
        ]
      }
      chats: {
        Row: {
          created_at: string
          deleted_at: string | null
          icon: string | null
          id: string
          owner_id: string
          pinned: boolean | null
          project_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          icon?: string | null
          id?: string
          owner_id: string
          pinned?: boolean | null
          project_id?: string | null
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          icon?: string | null
          id?: string
          owner_id?: string
          pinned?: boolean | null
          project_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chats_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chats_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          id: string
          name: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          id: string
          name?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string | null
        }
        Relationships: []
      }
      project_files: {
        Row: {
          created_at: string
          id: string
          name: string
          project_id: string
          size: number | null
          type: string | null
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          project_id: string
          size?: number | null
          type?: string | null
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          project_id?: string
          size?: number | null
          type?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          deleted_at: string | null
          description: string | null
          icon: string | null
          id: string
          instructions: string | null
          name: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          instructions?: string | null
          name: string
          owner_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          instructions?: string | null
          name?: string
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      prompts: {
        Row: {
          body: string
          created_at: string
          deleted_at: string | null
          icon: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          deleted_at?: string | null
          icon?: string
          id?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          deleted_at?: string | null
          icon?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      provider_credentials: {
        Row: {
          base_url: string | null
          id: string
          key_hint: string | null
          key_sealed: string | null
          label: string | null
          models: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          base_url?: string | null
          id: string
          key_hint?: string | null
          key_sealed?: string | null
          label?: string | null
          models?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          base_url?: string | null
          id?: string
          key_hint?: string | null
          key_sealed?: string | null
          label?: string | null
          models?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_credentials_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      schedules: {
        Row: {
          agent_id: string | null
          cadence: string
          chat_id: string | null
          created_at: string
          enabled: boolean
          hour_of_day: number
          id: string
          last_error: string
          last_run_at: string | null
          next_run_at: string
          project_id: string | null
          prompt: string
          run_count: number
          title: string
          updated_at: string
          user_id: string
          weekday: number
        }
        Insert: {
          agent_id?: string | null
          cadence?: string
          chat_id?: string | null
          created_at?: string
          enabled?: boolean
          hour_of_day?: number
          id?: string
          last_error?: string
          last_run_at?: string | null
          next_run_at?: string
          project_id?: string | null
          prompt: string
          run_count?: number
          title: string
          updated_at?: string
          user_id: string
          weekday?: number
        }
        Update: {
          agent_id?: string | null
          cadence?: string
          chat_id?: string | null
          created_at?: string
          enabled?: boolean
          hour_of_day?: number
          id?: string
          last_error?: string
          last_run_at?: string | null
          next_run_at?: string
          project_id?: string | null
          prompt?: string
          run_count?: number
          title?: string
          updated_at?: string
          user_id?: string
          weekday?: number
        }
        Relationships: []
      }
      sessions: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
