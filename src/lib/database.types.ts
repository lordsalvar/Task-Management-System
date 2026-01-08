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
      dim_category: {
        Row: {
          category_description: string | null
          category_id: number
          category_name: string
          color: string | null
          created_at: string
          icon: string | null
          updated_at: string
        }
        Insert: {
          category_description?: string | null
          category_id?: number
          category_name: string
          color?: string | null
          created_at?: string
          icon?: string | null
          updated_at?: string
        }
        Update: {
          category_description?: string | null
          category_id?: number
          category_name?: string
          color?: string | null
          created_at?: string
          icon?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      dim_date: {
        Row: {
          created_at: string
          date: string
          date_id: number
          day_name: string
          day_of_month: number
          day_of_week: number
          is_holiday: boolean
          is_weekend: boolean
          month: number
          month_name: string
          quarter: number
          week: number
          year: number
        }
        Insert: {
          created_at?: string
          date: string
          date_id?: number
          day_name: string
          day_of_month: number
          day_of_week: number
          is_holiday?: boolean
          is_weekend?: boolean
          month: number
          month_name: string
          quarter: number
          week: number
          year: number
        }
        Update: {
          created_at?: string
          date?: string
          date_id?: number
          day_name?: string
          day_of_month?: number
          day_of_week?: number
          is_holiday?: boolean
          is_weekend?: boolean
          month?: number
          month_name?: string
          quarter?: number
          week?: number
          year?: number
        }
        Relationships: []
      }
      dim_status: {
        Row: {
          created_at: string
          status_description: string | null
          status_id: number
          status_name: string
          status_order: number
        }
        Insert: {
          created_at?: string
          status_description?: string | null
          status_id?: number
          status_name: string
          status_order: number
        }
        Update: {
          created_at?: string
          status_description?: string | null
          status_id?: number
          status_name?: string
          status_order?: number
        }
        Relationships: []
      }
      dim_user: {
        Row: {
          auth_user_id: string | null
          created_at: string
          email: string | null
          name: string
          password: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          email?: string | null
          name: string
          password?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          email?: string | null
          name?: string
          password?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      fact_tasks: {
        Row: {
          actual_hours: number | null
          category_id: number | null
          completed_at: string | null
          completed_date_id: number | null
          created_at: string
          created_date_id: number
          estimated_hours: number | null
          is_completed: boolean
          status_id: number
          task_description: string | null
          task_id: string
          task_priority: number | null
          task_title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          actual_hours?: number | null
          category_id?: number | null
          completed_at?: string | null
          completed_date_id?: number | null
          created_at?: string
          created_date_id: number
          estimated_hours?: number | null
          is_completed?: boolean
          status_id: number
          task_description?: string | null
          task_id?: string
          task_priority?: number | null
          task_title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          actual_hours?: number | null
          category_id?: number | null
          completed_at?: string | null
          completed_date_id?: number | null
          created_at?: string
          created_date_id?: number
          estimated_hours?: number | null
          is_completed?: boolean
          status_id?: number
          task_description?: string | null
          task_id?: string
          task_priority?: number | null
          task_title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fact_tasks_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "dim_category"
            referencedColumns: ["category_id"]
          },
          {
            foreignKeyName: "fact_tasks_completed_date_id_fkey"
            columns: ["completed_date_id"]
            isOneToOne: false
            referencedRelation: "dim_date"
            referencedColumns: ["date_id"]
          },
          {
            foreignKeyName: "fact_tasks_created_date_id_fkey"
            columns: ["created_date_id"]
            isOneToOne: false
            referencedRelation: "dim_date"
            referencedColumns: ["date_id"]
          },
          {
            foreignKeyName: "fact_tasks_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "dim_status"
            referencedColumns: ["status_id"]
          },
          {
            foreignKeyName: "fact_tasks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dim_user"
            referencedColumns: ["user_id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          is_read: boolean
          message: string
          notification_id: string
          task_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          is_read?: boolean
          message: string
          notification_id?: string
          task_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          is_read?: boolean
          message?: string
          notification_id?: string
          task_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "fact_tasks"
            referencedColumns: ["task_id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dim_user"
            referencedColumns: ["user_id"]
          },
        ]
      }
      task_logs: {
        Row: {
          change_type: string
          completed_at: string | null
          completed_date_id: number | null
          created_at: string
          field_name: string | null
          log_date_id: number
          log_id: string
          new_value: string | null
          old_value: string | null
          task_id: string
          user_id: string
        }
        Insert: {
          change_type: string
          completed_at?: string | null
          completed_date_id?: number | null
          created_at?: string
          field_name?: string | null
          log_date_id: number
          log_id?: string
          new_value?: string | null
          old_value?: string | null
          task_id: string
          user_id: string
        }
        Update: {
          change_type?: string
          completed_at?: string | null
          completed_date_id?: number | null
          created_at?: string
          field_name?: string | null
          log_date_id?: number
          log_id?: string
          new_value?: string | null
          old_value?: string | null
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_logs_completed_date_id_fkey"
            columns: ["completed_date_id"]
            isOneToOne: false
            referencedRelation: "dim_date"
            referencedColumns: ["date_id"]
          },
          {
            foreignKeyName: "task_logs_log_date_id_fkey"
            columns: ["log_date_id"]
            isOneToOne: false
            referencedRelation: "dim_date"
            referencedColumns: ["date_id"]
          },
          {
            foreignKeyName: "task_logs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "fact_tasks"
            referencedColumns: ["task_id"]
          },
          {
            foreignKeyName: "task_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "dim_user"
            referencedColumns: ["user_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      populate_dim_date: {
        Args: { end_date: string; start_date: string }
        Returns: undefined
      }
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
