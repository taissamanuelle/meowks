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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      achievements: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
          year: number
        }
        Insert: {
          created_at?: string
          id?: string
          title: string
          updated_at?: string
          user_id: string
          year: number
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
          year?: number
        }
        Relationships: []
      }
      agent_documents: {
        Row: {
          agent_id: string
          content_text: string | null
          created_at: string
          file_name: string
          file_path: string
          file_type: string
          id: string
          user_id: string
        }
        Insert: {
          agent_id: string
          content_text?: string | null
          created_at?: string
          file_name: string
          file_path: string
          file_type: string
          id?: string
          user_id: string
        }
        Update: {
          agent_id?: string
          content_text?: string | null
          created_at?: string
          file_name?: string
          file_path?: string
          file_type?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_documents_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agents: {
        Row: {
          avatar_url: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          personality: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          personality?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          personality?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      api_usage: {
        Row: {
          created_at: string
          id: string
          input_tokens: number
          output_tokens: number
          request_count: number
          updated_at: string
          usage_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          input_tokens?: number
          output_tokens?: number
          request_count?: number
          updated_at?: string
          usage_date?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          input_tokens?: number
          output_tokens?: number
          request_count?: number
          updated_at?: string
          usage_date?: string
          user_id?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          agent_id: string | null
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          agent_id?: string | null
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          agent_id?: string | null
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      login_alerts: {
        Row: {
          acknowledged: boolean
          city: string | null
          country: string | null
          created_at: string
          id: string
          ip_address: string | null
          region: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          acknowledged?: boolean
          city?: string | null
          country?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          region?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          acknowledged?: boolean
          city?: string | null
          country?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          region?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      memories: {
        Row: {
          category: string | null
          content: string
          created_at: string
          id: string
          source: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          content: string
          created_at?: string
          id?: string
          source?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string
          id?: string
          source?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      neural_connections: {
        Row: {
          created_at: string
          id: string
          source_node_id: string
          strength: number
          target_node_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          source_node_id: string
          strength?: number
          target_node_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          source_node_id?: string
          strength?: number
          target_node_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "neural_connections_source_node_id_fkey"
            columns: ["source_node_id"]
            isOneToOne: false
            referencedRelation: "neural_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "neural_connections_target_node_id_fkey"
            columns: ["target_node_id"]
            isOneToOne: false
            referencedRelation: "neural_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      neural_nodes: {
        Row: {
          category: string
          created_at: string
          id: string
          importance: number
          label: string
          user_id: string
          x: number | null
          y: number | null
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          importance?: number
          label: string
          user_id: string
          x?: number | null
          y?: number | null
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          importance?: number
          label?: string
          user_id?: string
          x?: number | null
          y?: number | null
        }
        Relationships: []
      }
      pin_attempts: {
        Row: {
          attempted_at: string
          id: string
          user_id: string
        }
        Insert: {
          attempted_at?: string
          id?: string
          user_id: string
        }
        Update: {
          attempted_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      pin_sessions: {
        Row: {
          expires_at: string
          id: string
          user_id: string
          verified_at: string
        }
        Insert: {
          expires_at?: string
          id?: string
          user_id: string
          verified_at?: string
        }
        Update: {
          expires_at?: string
          id?: string
          user_id?: string
          verified_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          gemini_api_key: string | null
          id: string
          master_password_hash: string | null
          nickname: string | null
          pin_hash: string | null
          primary_conversation_id: string | null
          updated_at: string
          user_id: string
          webauthn_credential: Json | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          gemini_api_key?: string | null
          id?: string
          master_password_hash?: string | null
          nickname?: string | null
          pin_hash?: string | null
          primary_conversation_id?: string | null
          updated_at?: string
          user_id: string
          webauthn_credential?: Json | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          gemini_api_key?: string | null
          id?: string
          master_password_hash?: string | null
          nickname?: string | null
          pin_hash?: string | null
          primary_conversation_id?: string | null
          updated_at?: string
          user_id?: string
          webauthn_credential?: Json | null
        }
        Relationships: []
      }
      user_sessions: {
        Row: {
          city: string | null
          country: string | null
          created_at: string
          device_fingerprint: string
          id: string
          ip_address: string | null
          is_active: boolean
          last_active_at: string
          region: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string
          device_fingerprint: string
          id?: string
          ip_address?: string | null
          is_active?: boolean
          last_active_at?: string
          region?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string
          device_fingerprint?: string
          id?: string
          ip_address?: string | null
          is_active?: boolean
          last_active_at?: string
          region?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_allowed_email: { Args: never; Returns: boolean }
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
