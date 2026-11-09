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
      activity_log: {
        Row: {
          action: string
          actor: string
          approval_id: string | null
          at: string
          details: Json
          id: number
          owner_id: string
          store_id: string | null
          target: string | null
        }
        Insert: {
          action: string
          actor: string
          approval_id?: string | null
          at?: string
          details?: Json
          id?: never
          owner_id: string
          store_id?: string | null
          target?: string | null
        }
        Update: {
          action?: string
          actor?: string
          approval_id?: string | null
          at?: string
          details?: Json
          id?: never
          owner_id?: string
          store_id?: string | null
          target?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
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
      ai_threads: {
        Row: {
          created_at: string
          id: string
          messages: Json
          owner_id: string
          store_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          messages?: Json
          owner_id: string
          store_id?: string | null
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          messages?: Json
          owner_id?: string
          store_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_threads_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_sends: {
        Row: {
          campaign_id: string
          channel: string
          contact_id: string
          id: string
          sent_at: string | null
          skipped_reason: string | null
          status: string
          store_id: string
        }
        Insert: {
          campaign_id: string
          channel: string
          contact_id: string
          id?: string
          sent_at?: string | null
          skipped_reason?: string | null
          status: string
          store_id: string
        }
        Update: {
          campaign_id?: string
          channel?: string
          contact_id?: string
          id?: string
          sent_at?: string | null
          skipped_reason?: string | null
          status?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_sends_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_sends_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_sends_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          channels: string[]
          created_at: string
          id: string
          kind: string
          message: string
          name: string
          scheduled_at: string | null
          segment: string[]
          source: string
          status: string
          store_id: string
        }
        Insert: {
          channels?: string[]
          created_at?: string
          id?: string
          kind: string
          message?: string
          name: string
          scheduled_at?: string | null
          segment?: string[]
          source?: string
          status?: string
          store_id: string
        }
        Update: {
          channels?: string[]
          created_at?: string
          id?: string
          kind?: string
          message?: string
          name?: string
          scheduled_at?: string | null
          segment?: string[]
          source?: string
          status?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_bindings: {
        Row: {
          bound_at: string
          channel: string
          customer_ref: string
          store_id: string
        }
        Insert: {
          bound_at?: string
          channel: string
          customer_ref: string
          store_id: string
        }
        Update: {
          bound_at?: string
          channel?: string
          customer_ref?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_bindings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_consents: {
        Row: {
          channel: string
          consented_at: string
          contact_id: string
          id: string
          marketing: boolean
          source: string
          store_id: string
          withdrawn_at: string | null
        }
        Insert: {
          channel: string
          consented_at?: string
          contact_id: string
          id?: string
          marketing?: boolean
          source: string
          store_id: string
          withdrawn_at?: string | null
        }
        Update: {
          channel?: string
          consented_at?: string
          contact_id?: string
          id?: string
          marketing?: boolean
          source?: string
          store_id?: string
          withdrawn_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_consents_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_consents_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_labels: {
        Row: {
          contact_id: string
          label_id: string
          store_id: string
        }
        Insert: {
          contact_id: string
          label_id: string
          store_id: string
        }
        Update: {
          contact_id?: string
          label_id?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_labels_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_labels_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "labels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_labels_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          country: string | null
          created_at: string
          email: string | null
          first_seen_at: string
          id: string
          merged_into: string | null
          name: string | null
          phone: string | null
          source: string
          store_id: string
          telegram_username: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string
          email?: string | null
          first_seen_at?: string
          id?: string
          merged_into?: string | null
          name?: string | null
          phone?: string | null
          source: string
          store_id: string
          telegram_username?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string
          email?: string | null
          first_seen_at?: string
          id?: string
          merged_into?: string | null
          name?: string | null
          phone?: string | null
          source?: string
          store_id?: string
          telegram_username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_merged_into_fkey"
            columns: ["merged_into"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_store_id_fkey"
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
          contact_id: string | null
          created_at: string
          customer_ref: string
          handled_by: string
          id: string
          last_message_at: string
          source: string
          store_id: string
          whatsapp_window_ends_at: string | null
        }
        Insert: {
          agent_paused?: boolean
          channel: string
          contact_id?: string | null
          created_at?: string
          customer_ref: string
          handled_by?: string
          id?: string
          last_message_at?: string
          source?: string
          store_id: string
          whatsapp_window_ends_at?: string | null
        }
        Update: {
          agent_paused?: boolean
          channel?: string
          contact_id?: string | null
          created_at?: string
          customer_ref?: string
          handled_by?: string
          id?: string
          last_message_at?: string
          source?: string
          store_id?: string
          whatsapp_window_ends_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount_minor: number
          category: string
          created_at: string
          currency: string
          day: string
          id: string
          note: string | null
          receipt_media_id: string | null
          source: string
          store_id: string
        }
        Insert: {
          amount_minor: number
          category: string
          created_at?: string
          currency: string
          day: string
          id?: string
          note?: string | null
          receipt_media_id?: string | null
          source?: string
          store_id: string
        }
        Update: {
          amount_minor?: number
          category?: string
          created_at?: string
          currency?: string
          day?: string
          id?: string
          note?: string | null
          receipt_media_id?: string | null
          source?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_receipt_media_fk"
            columns: ["receipt_media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      fx_rates: {
        Row: {
          base: string
          day: string
          quote: string
          rate: number
          source: string
        }
        Insert: {
          base: string
          day: string
          quote: string
          rate: number
          source?: string
        }
        Update: {
          base?: string
          day?: string
          quote?: string
          rate?: number
          source?: string
        }
        Relationships: []
      }
      insights: {
        Row: {
          created_at: string
          finding: string
          id: string
          numbers: Json
          period: string
          source: string
          status: string
          store_id: string
          suggested_action: string | null
        }
        Insert: {
          created_at?: string
          finding: string
          id?: string
          numbers?: Json
          period: string
          source?: string
          status?: string
          store_id: string
          suggested_action?: string | null
        }
        Update: {
          created_at?: string
          finding?: string
          id?: string
          numbers?: Json
          period?: string
          source?: string
          status?: string
          store_id?: string
          suggested_action?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "insights_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      labels: {
        Row: {
          colour: string
          created_at: string
          id: string
          name: string
          store_id: string
          system: boolean
        }
        Insert: {
          colour?: string
          created_at?: string
          id?: string
          name: string
          store_id: string
          system?: boolean
        }
        Update: {
          colour?: string
          created_at?: string
          id?: string
          name?: string
          store_id?: string
          system?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "labels_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      link_clicks: {
        Row: {
          at: string
          country: string | null
          device: string | null
          id: number
          link_id: string
          store_id: string
        }
        Insert: {
          at?: string
          country?: string | null
          device?: string | null
          id?: never
          link_id: string
          store_id: string
        }
        Update: {
          at?: string
          country?: string | null
          device?: string | null
          id?: never
          link_id?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "link_clicks_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "tracked_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "link_clicks_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      media: {
        Row: {
          created_at: string
          id: string
          kind: string
          owner_id: string
          product_ids: string[]
          prompt_key: string | null
          source: string
          store_id: string | null
          tags: string[]
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          owner_id: string
          product_ids?: string[]
          prompt_key?: string | null
          source?: string
          store_id?: string | null
          tags?: string[]
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          owner_id?: string
          product_ids?: string[]
          prompt_key?: string | null
          source?: string
          store_id?: string | null
          tags?: string[]
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_store_id_fkey"
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
          buyer_country: string | null
          campaign_id: string | null
          channel: string
          charge_currency: string
          charge_total_minor: number
          contact_id: string | null
          created_at: string
          currency: string
          customer_ref: string | null
          delivery_country: string | null
          delivery_note: string | null
          fulfilled_at: string | null
          fx_rate: number | null
          fx_source: string | null
          id: string
          items: Json
          link_id: string | null
          paid_at: string | null
          paypal_capture_id: string | null
          paypal_fee_minor: number | null
          paypal_net_minor: number | null
          paypal_order_id: string | null
          refunded_charge_minor: number
          refunded_minor: number
          source: string
          status: string
          store_id: string
          tax_inclusive: boolean
          tax_minor: number
          tax_rate_bp: number
          total_minor: number
          updated_at: string
        }
        Insert: {
          buyer_country?: string | null
          campaign_id?: string | null
          channel?: string
          charge_currency: string
          charge_total_minor: number
          contact_id?: string | null
          created_at?: string
          currency: string
          customer_ref?: string | null
          delivery_country?: string | null
          delivery_note?: string | null
          fulfilled_at?: string | null
          fx_rate?: number | null
          fx_source?: string | null
          id?: string
          items: Json
          link_id?: string | null
          paid_at?: string | null
          paypal_capture_id?: string | null
          paypal_fee_minor?: number | null
          paypal_net_minor?: number | null
          paypal_order_id?: string | null
          refunded_charge_minor?: number
          refunded_minor?: number
          source?: string
          status?: string
          store_id: string
          tax_inclusive?: boolean
          tax_minor?: number
          tax_rate_bp?: number
          total_minor: number
          updated_at?: string
        }
        Update: {
          buyer_country?: string | null
          campaign_id?: string | null
          channel?: string
          charge_currency?: string
          charge_total_minor?: number
          contact_id?: string | null
          created_at?: string
          currency?: string
          customer_ref?: string | null
          delivery_country?: string | null
          delivery_note?: string | null
          fulfilled_at?: string | null
          fx_rate?: number | null
          fx_source?: string | null
          id?: string
          items?: Json
          link_id?: string | null
          paid_at?: string | null
          paypal_capture_id?: string | null
          paypal_fee_minor?: number | null
          paypal_net_minor?: number | null
          paypal_order_id?: string | null
          refunded_charge_minor?: number
          refunded_minor?: number
          source?: string
          status?: string
          store_id?: string
          tax_inclusive?: boolean
          tax_minor?: number
          tax_rate_bp?: number
          total_minor?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "tracked_links"
            referencedColumns: ["id"]
          },
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
          access_token: string | null
          created_at: string
          external_ids: Json
          id: string
          last_sync_result: Json | null
          last_synced_at: string | null
          last_used_at: string | null
          owner_id: string | null
          permissions: Json
          platform: string
          scope: string
          shop_domain: string | null
          status: string
          store_id: string | null
          token_expires_at: string | null
        }
        Insert: {
          access_token?: string | null
          created_at?: string
          external_ids?: Json
          id?: string
          last_sync_result?: Json | null
          last_synced_at?: string | null
          last_used_at?: string | null
          owner_id?: string | null
          permissions?: Json
          platform: string
          scope?: string
          shop_domain?: string | null
          status?: string
          store_id?: string | null
          token_expires_at?: string | null
        }
        Update: {
          access_token?: string | null
          created_at?: string
          external_ids?: Json
          id?: string
          last_sync_result?: Json | null
          last_synced_at?: string | null
          last_used_at?: string | null
          owner_id?: string | null
          permissions?: Json
          platform?: string
          scope?: string
          shop_domain?: string | null
          status?: string
          store_id?: string | null
          token_expires_at?: string | null
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
      post_metrics: {
        Row: {
          channel: string
          clicks: number
          day: string
          engagements: number
          impressions: number
          post_id: string
          reach: number
          source: string
          store_id: string
        }
        Insert: {
          channel: string
          clicks?: number
          day: string
          engagements?: number
          impressions?: number
          post_id: string
          reach?: number
          source?: string
          store_id: string
        }
        Update: {
          channel?: string
          clicks?: number
          day?: string
          engagements?: number
          impressions?: number
          post_id?: string
          reach?: number
          source?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_metrics_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_metrics_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          campaign_id: string | null
          caption: string
          caption_length: number | null
          channel: string | null
          content_type: string
          created_at: string
          id: string
          link_id: string | null
          media_url: string | null
          product_ids: string[]
          publish_results: Json
          scheduled_at: string | null
          source: string
          status: string
          store_id: string
          suggested_at: string | null
          targets: string[]
        }
        Insert: {
          campaign_id?: string | null
          caption?: string
          caption_length?: number | null
          channel?: string | null
          content_type?: string
          created_at?: string
          id?: string
          link_id?: string | null
          media_url?: string | null
          product_ids?: string[]
          publish_results?: Json
          scheduled_at?: string | null
          source?: string
          status?: string
          store_id: string
          suggested_at?: string | null
          targets?: string[]
        }
        Update: {
          campaign_id?: string | null
          caption?: string
          caption_length?: number | null
          channel?: string | null
          content_type?: string
          created_at?: string
          id?: string
          link_id?: string | null
          media_url?: string | null
          product_ids?: string[]
          publish_results?: Json
          scheduled_at?: string | null
          source?: string
          status?: string
          store_id?: string
          suggested_at?: string | null
          targets?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "posts_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "tracked_links"
            referencedColumns: ["id"]
          },
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
          category: string | null
          created_at: string
          currency: string
          daily_capacity: number | null
          description: string
          id: string
          image_url: string | null
          inventory_mode: string
          low_stock_threshold: number
          name: string
          price_minor: number
          source: string
          stock: number
          store_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string | null
          created_at?: string
          currency: string
          daily_capacity?: number | null
          description?: string
          id?: string
          image_url?: string | null
          inventory_mode?: string
          low_stock_threshold?: number
          name: string
          price_minor: number
          source?: string
          stock?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string | null
          created_at?: string
          currency?: string
          daily_capacity?: number | null
          description?: string
          id?: string
          image_url?: string | null
          inventory_mode?: string
          low_stock_threshold?: number
          name?: string
          price_minor?: number
          source?: string
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
      promotions: {
        Row: {
          code: string
          ends_at: string
          id: string
          kind: string
          product_ids: string[]
          source: string
          starts_at: string
          store_id: string
          value: number
        }
        Insert: {
          code: string
          ends_at: string
          id?: string
          kind: string
          product_ids?: string[]
          source?: string
          starts_at: string
          store_id: string
          value: number
        }
        Update: {
          code?: string
          ends_at?: string
          id?: string
          kind?: string
          product_ids?: string[]
          source?: string
          starts_at?: string
          store_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "promotions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      refunds: {
        Row: {
          amount_minor: number
          completed_at: string | null
          created_at: string
          currency: string
          fee_returned_minor: number | null
          id: string
          order_id: string
          paypal_refund_id: string | null
          reason: string | null
          requested_by: string
          restock: boolean
          source: string
          status: string
          store_amount_minor: number
          store_id: string
          vat_reversed_minor: number
        }
        Insert: {
          amount_minor: number
          completed_at?: string | null
          created_at?: string
          currency: string
          fee_returned_minor?: number | null
          id?: string
          order_id: string
          paypal_refund_id?: string | null
          reason?: string | null
          requested_by?: string
          restock?: boolean
          source?: string
          status?: string
          store_amount_minor: number
          store_id: string
          vat_reversed_minor?: number
        }
        Update: {
          amount_minor?: number
          completed_at?: string | null
          created_at?: string
          currency?: string
          fee_returned_minor?: number | null
          id?: string
          order_id?: string
          paypal_refund_id?: string | null
          reason?: string | null
          requested_by?: string
          restock?: boolean
          source?: string
          status?: string
          store_amount_minor?: number
          store_id?: string
          vat_reversed_minor?: number
        }
        Relationships: [
          {
            foreignKeyName: "refunds_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "refunds_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_store_id_fkey"
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
      store_visits: {
        Row: {
          day: string
          path: string
          store_id: string
          unique_visitors: number
          visits: number
        }
        Insert: {
          day: string
          path?: string
          store_id: string
          unique_visitors?: number
          visits?: number
        }
        Update: {
          day?: string
          path?: string
          store_id?: string
          unique_visitors?: number
          visits?: number
        }
        Relationships: [
          {
            foreignKeyName: "store_visits_store_id_fkey"
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
          business_profile: Json
          contact_channels: Json
          country: string | null
          created_at: string
          currency: string
          id: string
          is_demo: boolean
          owner_id: string
          prices_include_tax: boolean
          settlement_currency: string
          slug: string
          status: string
          store_language: string
          template_id: string | null
          template_version: number | null
          updated_at: string
          vat_rate_bp: number
          vat_registered: boolean
        }
        Insert: {
          agent_requests_date?: string
          agent_requests_today?: number
          brand_kit?: Json
          business_profile?: Json
          contact_channels?: Json
          country?: string | null
          created_at?: string
          currency?: string
          id?: string
          is_demo?: boolean
          owner_id: string
          prices_include_tax?: boolean
          settlement_currency?: string
          slug: string
          status?: string
          store_language?: string
          template_id?: string | null
          template_version?: number | null
          updated_at?: string
          vat_rate_bp?: number
          vat_registered?: boolean
        }
        Update: {
          agent_requests_date?: string
          agent_requests_today?: number
          brand_kit?: Json
          business_profile?: Json
          contact_channels?: Json
          country?: string | null
          created_at?: string
          currency?: string
          id?: string
          is_demo?: boolean
          owner_id?: string
          prices_include_tax?: boolean
          settlement_currency?: string
          slug?: string
          status?: string
          store_language?: string
          template_id?: string | null
          template_version?: number | null
          updated_at?: string
          vat_rate_bp?: number
          vat_registered?: boolean
        }
        Relationships: []
      }
      tracked_links: {
        Row: {
          campaign_id: string | null
          channel: string | null
          code: string
          created_at: string
          id: string
          post_id: string | null
          source: string
          store_id: string
          target: string
        }
        Insert: {
          campaign_id?: string | null
          channel?: string | null
          code: string
          created_at?: string
          id?: string
          post_id?: string | null
          source?: string
          store_id: string
          target: string
        }
        Update: {
          campaign_id?: string | null
          channel?: string | null
          code?: string
          created_at?: string
          id?: string
          post_id?: string | null
          source?: string
          store_id?: string
          target?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracked_links_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tracked_links_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tracked_links_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
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
      withdrawals: {
        Row: {
          created_at: string
          day: string
          id: string
          ngn_minor: number
          owner_id: string
          provider: string
          rate: number
          reference: string | null
          source: string
          store_id: string | null
          usd_minor: number
        }
        Insert: {
          created_at?: string
          day: string
          id?: string
          ngn_minor: number
          owner_id: string
          provider?: string
          rate: number
          reference?: string | null
          source?: string
          store_id?: string | null
          usd_minor: number
        }
        Update: {
          created_at?: string
          day?: string
          id?: string
          ngn_minor?: number
          owner_id?: string
          provider?: string
          rate?: number
          reference?: string | null
          source?: string
          store_id?: string | null
          usd_minor?: number
        }
        Relationships: [
          {
            foreignKeyName: "withdrawals_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      order_items: {
        Row: {
          currency: string | null
          line_minor: number | null
          name: string | null
          order_id: string | null
          paid_at: string | null
          product_id: string | null
          quantity: number | null
          source: string | null
          status: string | null
          store_id: string | null
          unit_minor: number | null
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
