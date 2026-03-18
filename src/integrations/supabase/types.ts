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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          performed_by: string
          records_affected: number | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          performed_by?: string
          records_affected?: number | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          performed_by?: string
          records_affected?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      branch_notification_settings: {
        Row: {
          branch_id: string
          created_at: string
          enabled: boolean
          id: string
          notification_emails: Json
          notification_staff: Json
          notification_timing: Json
          updated_at: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          enabled?: boolean
          id?: string
          notification_emails?: Json
          notification_staff?: Json
          notification_timing?: Json
          updated_at?: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          enabled?: boolean
          id?: string
          notification_emails?: Json
          notification_staff?: Json
          notification_timing?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branch_notification_settings_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: true
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      evacuation_attendance: {
        Row: {
          created_at: string
          drill_id: string
          evacuation_point_id: string | null
          id: string
          marked_by: string | null
          marked_safe_at: string | null
          notes: string | null
          person_name: string
          person_type: string
          status: string
          visitor_id: string | null
        }
        Insert: {
          created_at?: string
          drill_id: string
          evacuation_point_id?: string | null
          id?: string
          marked_by?: string | null
          marked_safe_at?: string | null
          notes?: string | null
          person_name: string
          person_type?: string
          status?: string
          visitor_id?: string | null
        }
        Update: {
          created_at?: string
          drill_id?: string
          evacuation_point_id?: string | null
          id?: string
          marked_by?: string | null
          marked_safe_at?: string | null
          notes?: string | null
          person_name?: string
          person_type?: string
          status?: string
          visitor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evacuation_attendance_drill_id_fkey"
            columns: ["drill_id"]
            isOneToOne: false
            referencedRelation: "evacuation_drills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evacuation_attendance_evacuation_point_id_fkey"
            columns: ["evacuation_point_id"]
            isOneToOne: false
            referencedRelation: "evacuation_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evacuation_attendance_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: false
            referencedRelation: "visitors"
            referencedColumns: ["id"]
          },
        ]
      }
      evacuation_drills: {
        Row: {
          accounted_for: number
          created_at: string
          ended_at: string | null
          id: string
          notes: string | null
          started_at: string
          started_by: string
          status: string
          title: string
          total_people: number
        }
        Insert: {
          accounted_for?: number
          created_at?: string
          ended_at?: string | null
          id?: string
          notes?: string | null
          started_at?: string
          started_by?: string
          status?: string
          title?: string
          total_people?: number
        }
        Update: {
          accounted_for?: number
          created_at?: string
          ended_at?: string | null
          id?: string
          notes?: string | null
          started_at?: string
          started_by?: string
          status?: string
          title?: string
          total_people?: number
        }
        Relationships: []
      }
      evacuation_points: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      feedback_questions: {
        Row: {
          category: string
          created_at: string
          id: string
          is_active: boolean
          question: string
          sort_order: number
          updated_at: string
          visitor_type: string
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          question: string
          sort_order?: number
          updated_at?: string
          visitor_type?: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          question?: string
          sort_order?: number
          updated_at?: string
          visitor_type?: string
        }
        Relationships: []
      }
      feedback_responses: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          question_id: string
          rating: number
          visitor_id: string | null
          visitor_name: string
          visitor_type: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          question_id: string
          rating: number
          visitor_id?: string | null
          visitor_name?: string
          visitor_type?: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          question_id?: string
          rating?: number
          visitor_id?: string | null
          visitor_name?: string
          visitor_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_responses_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "feedback_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_responses_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: false
            referencedRelation: "visitors"
            referencedColumns: ["id"]
          },
        ]
      }
      form_fields: {
        Row: {
          created_at: string
          field_key: string
          field_type: string
          id: string
          is_active: boolean
          label: string
          required: boolean
          sort_order: number
          updated_at: string
          visitor_type: string
        }
        Insert: {
          created_at?: string
          field_key: string
          field_type?: string
          id?: string
          is_active?: boolean
          label: string
          required?: boolean
          sort_order?: number
          updated_at?: string
          visitor_type?: string
        }
        Update: {
          created_at?: string
          field_key?: string
          field_type?: string
          id?: string
          is_active?: boolean
          label?: string
          required?: boolean
          sort_order?: number
          updated_at?: string
          visitor_type?: string
        }
        Relationships: []
      }
      gdpr_requirements: {
        Row: {
          id: string
          status: string
          updated_at: string
        }
        Insert: {
          id: string
          status?: string
          updated_at?: string
        }
        Update: {
          id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      health_questions: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          options: Json | null
          placeholder: string | null
          question: string
          required: boolean
          sort_order: number
          type: string
          updated_at: string
          visitor_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          options?: Json | null
          placeholder?: string | null
          question: string
          required?: boolean
          sort_order?: number
          type?: string
          updated_at?: string
          visitor_type?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          options?: Json | null
          placeholder?: string | null
          question?: string
          required?: boolean
          sort_order?: number
          type?: string
          updated_at?: string
          visitor_type?: string
        }
        Relationships: []
      }
      leave_requests: {
        Row: {
          comments: string | null
          companions: Json | null
          created_at: string
          expected_departure: string | null
          expected_return: string | null
          external_reference: string | null
          id: string
          leave_type: string | null
          reason: string | null
          resident_name: string
          resident_room: string | null
          resident_wing: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source: string
          status: string
          updated_at: string
          visitor_id: string | null
        }
        Insert: {
          comments?: string | null
          companions?: Json | null
          created_at?: string
          expected_departure?: string | null
          expected_return?: string | null
          external_reference?: string | null
          id?: string
          leave_type?: string | null
          reason?: string | null
          resident_name: string
          resident_room?: string | null
          resident_wing?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: string
          status?: string
          updated_at?: string
          visitor_id?: string | null
        }
        Update: {
          comments?: string | null
          companions?: Json | null
          created_at?: string
          expected_departure?: string | null
          expected_return?: string | null
          external_reference?: string | null
          id?: string
          leave_type?: string | null
          reason?: string | null
          resident_name?: string
          resident_room?: string | null
          resident_wing?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: string
          status?: string
          updated_at?: string
          visitor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: false
            referencedRelation: "visitors"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_types: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          emoji: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          emoji?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          emoji?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          role_title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          role_title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          role_title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      resident_details: {
        Row: {
          care_level: string | null
          created_at: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          id: string
          key_worker: string | null
          notes: string | null
          photo_url: string | null
          room: string | null
          updated_at: string | null
          visitor_id: string
          wing_id: string | null
        }
        Insert: {
          care_level?: string | null
          created_at?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          id?: string
          key_worker?: string | null
          notes?: string | null
          photo_url?: string | null
          room?: string | null
          updated_at?: string | null
          visitor_id: string
          wing_id?: string | null
        }
        Update: {
          care_level?: string | null
          created_at?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          id?: string
          key_worker?: string | null
          notes?: string | null
          photo_url?: string | null
          room?: string | null
          updated_at?: string | null
          visitor_id?: string
          wing_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "resident_details_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: true
            referencedRelation: "visitors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resident_details_wing_id_fkey"
            columns: ["wing_id"]
            isOneToOne: false
            referencedRelation: "wings"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vaccination_fields: {
        Row: {
          created_at: string
          field_type: string
          id: string
          is_active: boolean
          label: string
          name: string
          options: Json | null
          required: boolean
          sort_order: number
          updated_at: string
          visitor_type: string
        }
        Insert: {
          created_at?: string
          field_type?: string
          id?: string
          is_active?: boolean
          label: string
          name: string
          options?: Json | null
          required?: boolean
          sort_order?: number
          updated_at?: string
          visitor_type?: string
        }
        Update: {
          created_at?: string
          field_type?: string
          id?: string
          is_active?: boolean
          label?: string
          name?: string
          options?: Json | null
          required?: boolean
          sort_order?: number
          updated_at?: string
          visitor_type?: string
        }
        Relationships: []
      }
      visitor_watchlist: {
        Row: {
          added_by: string
          alert_type: string | null
          branch_id: string | null
          created_at: string | null
          first_name: string
          id: string
          instructions: string | null
          is_active: boolean | null
          photo_url: string | null
          reason: string
          surname: string
          updated_at: string | null
        }
        Insert: {
          added_by?: string
          alert_type?: string | null
          branch_id?: string | null
          created_at?: string | null
          first_name: string
          id?: string
          instructions?: string | null
          is_active?: boolean | null
          photo_url?: string | null
          reason: string
          surname: string
          updated_at?: string | null
        }
        Update: {
          added_by?: string
          alert_type?: string | null
          branch_id?: string | null
          created_at?: string | null
          first_name?: string
          id?: string
          instructions?: string | null
          is_active?: boolean | null
          photo_url?: string | null
          reason?: string
          surname?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visitor_watchlist_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      visitors: {
        Row: {
          accompanied_by: string | null
          accompanied_by_name: string | null
          additional_visitors: number | null
          address: string | null
          body_temperature: number | null
          branch_id: string | null
          check_in_time: string
          check_out_time: string | null
          checkout_reason: string | null
          comments: string | null
          companion_details: Json | null
          created_at: string
          email: string
          expected_return_date: string | null
          first_name: string
          health_answers: Json | null
          health_declaration: boolean | null
          id: string
          leave_type: string | null
          mobile: string
          privacy_acknowledged: boolean | null
          return_notification_opt_in: boolean | null
          status: string
          surname: string
          type: string
          whom_to_visit: string | null
        }
        Insert: {
          accompanied_by?: string | null
          accompanied_by_name?: string | null
          additional_visitors?: number | null
          address?: string | null
          body_temperature?: number | null
          branch_id?: string | null
          check_in_time?: string
          check_out_time?: string | null
          checkout_reason?: string | null
          comments?: string | null
          companion_details?: Json | null
          created_at?: string
          email: string
          expected_return_date?: string | null
          first_name: string
          health_answers?: Json | null
          health_declaration?: boolean | null
          id?: string
          leave_type?: string | null
          mobile: string
          privacy_acknowledged?: boolean | null
          return_notification_opt_in?: boolean | null
          status?: string
          surname: string
          type?: string
          whom_to_visit?: string | null
        }
        Update: {
          accompanied_by?: string | null
          accompanied_by_name?: string | null
          additional_visitors?: number | null
          address?: string | null
          body_temperature?: number | null
          branch_id?: string | null
          check_in_time?: string
          check_out_time?: string | null
          checkout_reason?: string | null
          comments?: string | null
          companion_details?: Json | null
          created_at?: string
          email?: string
          expected_return_date?: string | null
          first_name?: string
          health_answers?: Json | null
          health_declaration?: boolean | null
          id?: string
          leave_type?: string | null
          mobile?: string
          privacy_acknowledged?: boolean | null
          return_notification_opt_in?: boolean | null
          status?: string
          surname?: string
          type?: string
          whom_to_visit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visitors_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      wings: {
        Row: {
          branch_id: string | null
          color: string | null
          created_at: string | null
          floor: string | null
          id: string
          is_active: boolean | null
          name: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          branch_id?: string | null
          color?: string | null
          created_at?: string | null
          floor?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          branch_id?: string | null
          color?: string | null
          created_at?: string | null
          floor?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wings_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "staff" | "user"
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
      app_role: ["admin", "staff", "user"],
    },
  },
} as const
