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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      announcements: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          is_active: boolean
          message: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          message: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          message?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          id: boolean
          ordering_mode: string
          require_order_otp: boolean
          show_combos: boolean
          show_specials: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: boolean
          ordering_mode?: string
          require_order_otp?: boolean
          show_combos?: boolean
          show_specials?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: boolean
          ordering_mode?: string
          require_order_otp?: boolean
          show_combos?: boolean
          show_specials?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          id: string
          is_hidden: boolean
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_hidden?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_hidden?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      combo_items: {
        Row: {
          combo_id: string
          created_at: string
          id: string
          menu_item_id: string
          quantity: number
        }
        Insert: {
          combo_id: string
          created_at?: string
          id?: string
          menu_item_id: string
          quantity?: number
        }
        Update: {
          combo_id?: string
          created_at?: string
          id?: string
          menu_item_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "combo_items_combo_id_fkey"
            columns: ["combo_id"]
            isOneToOne: false
            referencedRelation: "combos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "combo_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
      combos: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          is_special: boolean
          name: string
          offer_price: number
          original_price: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_special?: boolean
          name: string
          offer_price?: number
          original_price?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_special?: boolean
          name?: string
          offer_price?: number
          original_price?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      feedback: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          order_id: string | null
          rating: number
          table_number: number | null
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          order_id?: string | null
          rating: number
          table_number?: number | null
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          order_id?: string | null
          rating?: number
          table_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "feedback_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_available: boolean
          is_special: boolean
          is_veg: boolean
          name: string
          price: number
          sort_order: number
          updated_at: string
          variants: Json
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          is_special?: boolean
          is_veg?: boolean
          name: string
          price: number
          sort_order?: number
          updated_at?: string
          variants?: Json
        }
        Update: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          is_special?: boolean
          is_veg?: boolean
          name?: string
          price?: number
          sort_order?: number
          updated_at?: string
          variants?: Json
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_reports: {
        Row: {
          avg_order_value: number
          created_at: string
          created_by: string | null
          id: string
          item_breakdown: Json
          label: string
          overall: Json
          period_end: string
          period_start: string
          total_items: number
          total_orders: number
          total_revenue: number
        }
        Insert: {
          avg_order_value?: number
          created_at?: string
          created_by?: string | null
          id?: string
          item_breakdown?: Json
          label: string
          overall?: Json
          period_end: string
          period_start: string
          total_items?: number
          total_orders?: number
          total_revenue?: number
        }
        Update: {
          avg_order_value?: number
          created_at?: string
          created_by?: string | null
          id?: string
          item_breakdown?: Json
          label?: string
          overall?: Json
          period_end?: string
          period_start?: string
          total_items?: number
          total_orders?: number
          total_revenue?: number
        }
        Relationships: []
      }
      order_items: {
        Row: {
          added_by_kitchen: boolean
          cancelled_at: string | null
          created_at: string
          id: string
          is_cancelled: boolean
          is_prepared: boolean
          menu_item_id: string | null
          name: string
          order_id: string
          prepared_at: string | null
          prepared_quantity: number
          quantity: number
          unit_price: number
          variant_label: string | null
        }
        Insert: {
          added_by_kitchen?: boolean
          cancelled_at?: string | null
          created_at?: string
          id?: string
          is_cancelled?: boolean
          is_prepared?: boolean
          menu_item_id?: string | null
          name: string
          order_id: string
          prepared_at?: string | null
          prepared_quantity?: number
          quantity: number
          unit_price: number
          variant_label?: string | null
        }
        Update: {
          added_by_kitchen?: boolean
          cancelled_at?: string | null
          created_at?: string
          id?: string
          is_cancelled?: boolean
          is_prepared?: boolean
          menu_item_id?: string | null
          name?: string
          order_id?: string
          prepared_at?: string | null
          prepared_quantity?: number
          quantity?: number
          unit_price?: number
          variant_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          customer_name: string | null
          customer_phone: string | null
          id: string
          idempotency_key: string | null
          is_paid: boolean
          is_rush: boolean
          last_appended_at: string | null
          notes: string | null
          otp_issued_at: string | null
          otp_verified: boolean
          payment_method: string | null
          session_id: string | null
          staff_otp: string | null
          status: Database["public"]["Enums"]["order_status"]
          table_number: number
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          idempotency_key?: string | null
          is_paid?: boolean
          is_rush?: boolean
          last_appended_at?: string | null
          notes?: string | null
          otp_issued_at?: string | null
          otp_verified?: boolean
          payment_method?: string | null
          session_id?: string | null
          staff_otp?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          table_number: number
          total?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          idempotency_key?: string | null
          is_paid?: boolean
          is_rush?: boolean
          last_appended_at?: string | null
          notes?: string | null
          otp_issued_at?: string | null
          otp_verified?: boolean
          payment_method?: string | null
          session_id?: string | null
          staff_otp?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          table_number?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "table_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_tables: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          label: string | null
          table_number: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string | null
          table_number: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string | null
          table_number?: number
        }
        Relationships: []
      }
      table_sessions: {
        Row: {
          closed_at: string | null
          created_at: string
          id: string
          status: string
          table_number: number
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          id?: string
          status?: string
          table_number: number
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          id?: string
          status?: string
          table_number?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      waiter_calls: {
        Row: {
          created_at: string
          id: string
          note: string | null
          resolved_at: string | null
          session_id: string | null
          status: string
          table_number: number
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          resolved_at?: string | null
          session_id?: string | null
          status?: string
          table_number: number
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          resolved_at?: string | null
          session_id?: string | null
          status?: string
          table_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "waiter_calls_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "table_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      append_order_items: {
        Args: {
          _added_total: number
          _customer_name: string
          _customer_phone: string
          _idempotency_key: string
          _items: Json
          _notes: string
          _session_id: string
          _table_number: number
        }
        Returns: string
      }
      cancel_order: { Args: { _order_id: string }; Returns: undefined }
      cancel_order_item: { Args: { _item_id: string }; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      reset_app_data: { Args: never; Returns: undefined }
      set_item_prepared: {
        Args: { _item_id: string; _prepared: boolean }
        Returns: undefined
      }
      tick_item_prepared: {
        Args: { _delta: number; _item_id: string }
        Returns: undefined
      }
      verify_order_otp: {
        Args: { _code: string; _order_id: string }
        Returns: boolean
      }
      waiter_place_order: {
        Args: {
          _customer_name: string
          _customer_phone: string
          _idempotency_key: string
          _items: Json
          _notes: string
          _table_number: number
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "kitchen" | "pro_admin"
      order_status: "pending" | "preparing" | "ready" | "served" | "cancelled"
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
    Enums: {
      app_role: ["admin", "kitchen", "pro_admin"],
      order_status: ["pending", "preparing", "ready", "served", "cancelled"],
    },
  },
} as const
