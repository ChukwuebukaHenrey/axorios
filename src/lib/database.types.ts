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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      agent_sessions: {
        Row: {
          id: string
          messages: Json
          store_id: string
          updated_at: string
        }
        Insert: {
          id?: string
          messages?: Json
          store_id: string
          updated_at?: string
        }
        Update: {
          id?: string
          messages?: Json
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_sessions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          agent_paused: boolean
          channel: string
          created_at: string
          customer_ref: string
          id: string
          last_message_at: string
          store_id: string
        }
        Insert: {
          agent_paused?: boolean
          channel: string
          created_at?: string
          customer_ref: string
          id?: string
          last_message_at?: string
          store_id: string
        }
        Update: {
          agent_paused?: boolean
          channel?: string
          created_at?: string
          customer_ref?: string
          id?: string
          last_message_at?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          store_id: string
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
          store_id: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          channel: string
          charge_currency: string
          charge_total_minor: number
          created_at: string
          currency: string
          customer_ref: string | null
          delivery_note: string | null
          fx_rate: number | null
          fx_source: string | null
          id: string
          items: Json
          paid_at: string | null
          paypal_capture_id: string | null
          paypal_order_id: string | null
          status: string
          store_id: string
          total_minor: number
          updated_at: string
        }
        Insert: {
          channel?: string
          charge_currency: string
          charge_total_minor: number
          created_at?: string
          currency: string
          customer_ref?: string | null
          delivery_note?: string | null
          fx_rate?: number | null
          fx_source?: string | null
          id?: string
          items: Json
          paid_at?: string | null
          paypal_capture_id?: string | null
          paypal_order_id?: string | null
          status?: string
          store_id: string
          total_minor: number
          updated_at?: string
        }
        Update: {
          channel?: string
          charge_currency?: string
          charge_total_minor?: number
          created_at?: string
          currency?: string
          customer_ref?: string | null
          delivery_note?: string | null
          fx_rate?: number | null
          fx_source?: string | null
          id?: string
          items?: Json
          paid_at?: string | null
          paypal_capture_id?: string | null
          paypal_order_id?: string | null
          status?: string
          store_id?: string
          total_minor?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_connections: {
        Row: {
          access_token: string
          created_at: string
          external_ids: Json
          id: string
          last_synced_at: string | null
          platform: string
          shop_domain: string
          store_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          external_ids?: Json
          id?: string
          last_synced_at?: string | null
          platform: string
          shop_domain: string
          store_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          external_ids?: Json
          id?: string
          last_synced_at?: string | null
          platform?: string
          shop_domain?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_connections_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          caption: string
          created_at: string
          id: string
          media_url: string | null
          publish_results: Json
          scheduled_at: string | null
          status: string
          store_id: string
          targets: string[]
        }
        Insert: {
          caption?: string
          created_at?: string
          id?: string
          media_url?: string | null
          publish_results?: Json
          scheduled_at?: string | null
          status?: string
          store_id: string
          targets?: string[]
        }
        Update: {
          caption?: string
          created_at?: string
          id?: string
          media_url?: string | null
          publish_results?: Json
          scheduled_at?: string | null
          status?: string
          store_id?: string
          targets?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "posts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          created_at: string
          currency: string
          description: string
          id: string
          image_url: string | null
          name: string
          price_minor: number
          stock: number
          store_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          currency: string
          description?: string
          id?: string
          image_url?: string | null
          name: string
          price_minor: number
          stock?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          currency?: string
          description?: string
          id?: string
          image_url?: string | null
          name?: string
          price_minor?: number
          stock?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      site_versions: {
        Row: {
          config: Json
          created_at: string
          created_by: string
          id: string
          status: string
          store_id: string
          template_id: string
        }
        Insert: {
          config: Json
          created_at?: string
          created_by: string
          id?: string
          status?: string
          store_id: string
          template_id: string
        }
        Update: {
          config?: Json
          created_at?: string
          created_by?: string
          id?: string
          status?: string
          store_id?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_versions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          agent_requests_date: string
          agent_requests_today: number
          brand_kit: Json
          contact_channels: Json
          created_at: string
          currency: string
          id: string
          owner_id: string
          settlement_currency: string
          slug: string
          status: string
          store_language: string
          updated_at: string
        }
        Insert: {
          agent_requests_date?: string
          agent_requests_today?: number
          brand_kit?: Json
          contact_channels?: Json
          created_at?: string
          currency?: string
          id?: string
          owner_id: string
          settlement_currency?: string
          slug: string
          status?: string
          store_language?: string
          updated_at?: string
        }
        Update: {
          agent_requests_date?: string
          agent_requests_today?: number
          brand_kit?: Json
          contact_channels?: Json
          created_at?: string
          currency?: string
          id?: string
          owner_id?: string
          settlement_currency?: string
          slug?: string
          status?: string
          store_language?: string
          updated_at?: string
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          created_at: string
          event_id: string
          id: string
          payload: Json
          processed_at: string | null
          provider: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          payload: Json
          processed_at?: string | null
          provider: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          provider?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      owns_store: { Args: { target: string }; Returns: boolean }
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
