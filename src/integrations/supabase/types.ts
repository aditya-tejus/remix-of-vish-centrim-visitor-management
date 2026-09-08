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
      audit_log: {
        Row: {
          action: string
          change_reason: string | null
          created_at: string
          details: Json | null
          id: string
          performed_by: string
          records_affected: number | null
          user_id: string | null
        }
        Insert: {
          action: string
          change_reason?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          performed_by?: string
          records_affected?: number | null
          user_id?: string | null
        }
        Update: {
          action?: string
          change_reason?: string | null
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
          branch_id: string | null
          created_at: string
          enabled: boolean
          id: string
          notification_emails: Json
          notification_staff: Json
          notification_timing: Json
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          notification_emails?: Json
          notification_staff?: Json
          notification_timing?: Json
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
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
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          code: string | null
          created_at: string
          id: string
          is_active: boolean
          is_legacy_placeholder: boolean
          jurisdiction: string | null
          name: string
          organisation_id: string | null
          site_structure: string | null
          timezone: string | null
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_legacy_placeholder?: boolean
          jurisdiction?: string | null
          name: string
          organisation_id?: string | null
          site_structure?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_legacy_placeholder?: boolean
          jurisdiction?: string | null
          name?: string
          organisation_id?: string | null
          site_structure?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branches_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      contractor_credentials: {
        Row: {
          created_at: string
          credential_type_id: string
          document_path: string | null
          expiry_date: string | null
          id: string
          person_id: string
          reference: string | null
          updated_at: string
          uploaded_at: string | null
          uploaded_by: string | null
          verification_status: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          created_at?: string
          credential_type_id: string
          document_path?: string | null
          expiry_date?: string | null
          id?: string
          person_id: string
          reference?: string | null
          updated_at?: string
          uploaded_at?: string | null
          uploaded_by?: string | null
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string
          credential_type_id?: string
          document_path?: string | null
          expiry_date?: string | null
          id?: string
          person_id?: string
          reference?: string | null
          updated_at?: string
          uploaded_at?: string | null
          uploaded_by?: string | null
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contractor_credentials_credential_type_id_fkey"
            columns: ["credential_type_id"]
            isOneToOne: false
            referencedRelation: "credential_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contractor_credentials_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "contractor_people"
            referencedColumns: ["id"]
          },
        ]
      }
      contractor_people: {
        Row: {
          branch_id: string | null
          created_at: string
          email: string | null
          first_name: string
          id: string
          is_active: boolean
          mobile: string | null
          notes: string | null
          person_qr: string | null
          supplier_id: string | null
          surname: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          email?: string | null
          first_name: string
          id?: string
          is_active?: boolean
          mobile?: string | null
          notes?: string | null
          person_qr?: string | null
          supplier_id?: string | null
          surname: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          email?: string | null
          first_name?: string
          id?: string
          is_active?: boolean
          mobile?: string | null
          notes?: string | null
          person_qr?: string | null
          supplier_id?: string | null
          surname?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contractor_people_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contractor_people_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers_min"
            referencedColumns: ["id"]
          },
        ]
      }
      contractor_question_answers: {
        Row: {
          answer: Json | null
          answered_at: string
          answered_by: string | null
          created_at: string
          expires_at: string | null
          id: string
          person_id: string | null
          question_id: string
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          answer?: Json | null
          answered_at?: string
          answered_by?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          person_id?: string | null
          question_id: string
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          answer?: Json | null
          answered_at?: string
          answered_by?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          person_id?: string | null
          question_id?: string
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contractor_question_answers_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "contractor_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contractor_question_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "contractor_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contractor_question_answers_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers_min"
            referencedColumns: ["id"]
          },
        ]
      }
      contractor_questions: {
        Row: {
          answered_by: string
          blocks_on_no: boolean
          created_at: string
          id: string
          input_type: string
          is_active: boolean
          jurisdiction: string
          key: string
          label: string
          options: Json | null
          owner_scope: string
          required: boolean
          sort_order: number
          updated_at: string
          validity_days: number | null
        }
        Insert: {
          answered_by?: string
          blocks_on_no?: boolean
          created_at?: string
          id?: string
          input_type?: string
          is_active?: boolean
          jurisdiction?: string
          key: string
          label: string
          options?: Json | null
          owner_scope?: string
          required?: boolean
          sort_order?: number
          updated_at?: string
          validity_days?: number | null
        }
        Update: {
          answered_by?: string
          blocks_on_no?: boolean
          created_at?: string
          id?: string
          input_type?: string
          is_active?: boolean
          jurisdiction?: string
          key?: string
          label?: string
          options?: Json | null
          owner_scope?: string
          required?: boolean
          sort_order?: number
          updated_at?: string
          validity_days?: number | null
        }
        Relationships: []
      }
      credential_types: {
        Row: {
          created_at: string
          holder_scope: string
          id: string
          is_active: boolean
          is_required: boolean
          jurisdiction: string
          key: string
          label: string
          requires_document: boolean
          short_label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          holder_scope?: string
          id?: string
          is_active?: boolean
          is_required?: boolean
          jurisdiction?: string
          key: string
          label: string
          requires_document?: boolean
          short_label: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          holder_scope?: string
          id?: string
          is_active?: boolean
          is_required?: boolean
          jurisdiction?: string
          key?: string
          label?: string
          requires_document?: boolean
          short_label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      evacuation_attendance: {
        Row: {
          area_label: string | null
          assistance_level: string | null
          associated_with: string | null
          branch_id: string | null
          companion_index: number | null
          contact_phone: string | null
          created_at: string
          drill_id: string
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          evacuation_point_id: string | null
          id: string
          marked_by: string | null
          marked_safe_at: string | null
          notes: string | null
          parent_visitor_id: string | null
          person_name: string
          person_type: string
          responsible_staff: string | null
          room_label: string | null
          status: string
          visitor_id: string | null
        }
        Insert: {
          area_label?: string | null
          assistance_level?: string | null
          associated_with?: string | null
          branch_id?: string | null
          companion_index?: number | null
          contact_phone?: string | null
          created_at?: string
          drill_id: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          evacuation_point_id?: string | null
          id?: string
          marked_by?: string | null
          marked_safe_at?: string | null
          notes?: string | null
          parent_visitor_id?: string | null
          person_name: string
          person_type?: string
          responsible_staff?: string | null
          room_label?: string | null
          status?: string
          visitor_id?: string | null
        }
        Update: {
          area_label?: string | null
          assistance_level?: string | null
          associated_with?: string | null
          branch_id?: string | null
          companion_index?: number | null
          contact_phone?: string | null
          created_at?: string
          drill_id?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          evacuation_point_id?: string | null
          id?: string
          marked_by?: string | null
          marked_safe_at?: string | null
          notes?: string | null
          parent_visitor_id?: string | null
          person_name?: string
          person_type?: string
          responsible_staff?: string | null
          room_label?: string | null
          status?: string
          visitor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evacuation_attendance_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
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
            foreignKeyName: "evacuation_attendance_parent_visitor_id_fkey"
            columns: ["parent_visitor_id"]
            isOneToOne: false
            referencedRelation: "v_legacy_visitor_visits"
            referencedColumns: ["legacy_visitor_id"]
          },
          {
            foreignKeyName: "evacuation_attendance_parent_visitor_id_fkey"
            columns: ["parent_visitor_id"]
            isOneToOne: false
            referencedRelation: "visitors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evacuation_attendance_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: false
            referencedRelation: "v_legacy_visitor_visits"
            referencedColumns: ["legacy_visitor_id"]
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
          branch_id: string | null
          created_at: string
          ended_at: string | null
          event_type: string
          id: string
          notes: string | null
          started_at: string
          started_by: string
          status: string
          title: string
          total_people: number
          unaccounted_reason: string | null
        }
        Insert: {
          accounted_for?: number
          branch_id?: string | null
          created_at?: string
          ended_at?: string | null
          event_type?: string
          id?: string
          notes?: string | null
          started_at?: string
          started_by?: string
          status?: string
          title?: string
          total_people?: number
          unaccounted_reason?: string | null
        }
        Update: {
          accounted_for?: number
          branch_id?: string | null
          created_at?: string
          ended_at?: string | null
          event_type?: string
          id?: string
          notes?: string | null
          started_at?: string
          started_by?: string
          status?: string
          title?: string
          total_people?: number
          unaccounted_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evacuation_drills_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      evacuation_points: {
        Row: {
          branch_id: string | null
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
          branch_id?: string | null
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
          branch_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evacuation_points_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback_questions: {
        Row: {
          category: string
          created_at: string
          id: string
          is_active: boolean
          question: string
          sort_order: number
          survey_id: string | null
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
          survey_id?: string | null
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
          survey_id?: string | null
          updated_at?: string
          visitor_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_questions_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "feedback_surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback_responses: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          question_id: string
          rating: number
          survey_id: string | null
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
          survey_id?: string | null
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
          survey_id?: string | null
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
            foreignKeyName: "feedback_responses_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "feedback_surveys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_responses_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: false
            referencedRelation: "v_legacy_visitor_visits"
            referencedColumns: ["legacy_visitor_id"]
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
      feedback_surveys: {
        Row: {
          assigned_types: string[]
          created_at: string
          description: string | null
          external_url: string | null
          id: string
          is_active: boolean
          sort_order: number
          source: string
          title: string
          trigger_point: string
          updated_at: string
        }
        Insert: {
          assigned_types?: string[]
          created_at?: string
          description?: string | null
          external_url?: string | null
          id?: string
          is_active?: boolean
          sort_order?: number
          source?: string
          title: string
          trigger_point?: string
          updated_at?: string
        }
        Update: {
          assigned_types?: string[]
          created_at?: string
          description?: string | null
          external_url?: string | null
          id?: string
          is_active?: boolean
          sort_order?: number
          source?: string
          title?: string
          trigger_point?: string
          updated_at?: string
        }
        Relationships: []
      }
      food_register: {
        Row: {
          branch_id: string | null
          brought_by_name: string
          created_at: string
          created_by: string | null
          food_description: string
          food_type: string
          id: string
          notes: string | null
          recorded_at: string
          resident_name: string
          resident_visitor_id: string | null
          shared_resident_ids: string[]
          shared_resident_names: string[]
          shared_with_others: boolean
          source: string
          updated_at: string
          visitor_id: string | null
        }
        Insert: {
          branch_id?: string | null
          brought_by_name: string
          created_at?: string
          created_by?: string | null
          food_description: string
          food_type?: string
          id?: string
          notes?: string | null
          recorded_at?: string
          resident_name: string
          resident_visitor_id?: string | null
          shared_resident_ids?: string[]
          shared_resident_names?: string[]
          shared_with_others?: boolean
          source?: string
          updated_at?: string
          visitor_id?: string | null
        }
        Update: {
          branch_id?: string | null
          brought_by_name?: string
          created_at?: string
          created_by?: string | null
          food_description?: string
          food_type?: string
          id?: string
          notes?: string | null
          recorded_at?: string
          resident_name?: string
          resident_visitor_id?: string | null
          shared_resident_ids?: string[]
          shared_resident_names?: string[]
          shared_with_others?: boolean
          source?: string
          updated_at?: string
          visitor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "food_register_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_register_resident_visitor_id_fkey"
            columns: ["resident_visitor_id"]
            isOneToOne: false
            referencedRelation: "v_legacy_visitor_visits"
            referencedColumns: ["legacy_visitor_id"]
          },
          {
            foreignKeyName: "food_register_resident_visitor_id_fkey"
            columns: ["resident_visitor_id"]
            isOneToOne: false
            referencedRelation: "visitors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_register_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: false
            referencedRelation: "v_legacy_visitor_visits"
            referencedColumns: ["legacy_visitor_id"]
          },
          {
            foreignKeyName: "food_register_visitor_id_fkey"
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
      key_issues: {
        Row: {
          branch_id: string | null
          condition_notes: string | null
          created_at: string
          expected_return: string | null
          id: string
          is_permanent: boolean
          issued_at: string
          issued_by: string
          issued_to_name: string
          issued_to_staff_id: string | null
          issued_to_type: string
          key_id: string
          notes: string | null
          returned_at: string | null
          returned_to: string | null
          supplier_id: string | null
          updated_at: string
          visitor_id: string | null
        }
        Insert: {
          branch_id?: string | null
          condition_notes?: string | null
          created_at?: string
          expected_return?: string | null
          id?: string
          is_permanent?: boolean
          issued_at?: string
          issued_by: string
          issued_to_name: string
          issued_to_staff_id?: string | null
          issued_to_type?: string
          key_id: string
          notes?: string | null
          returned_at?: string | null
          returned_to?: string | null
          supplier_id?: string | null
          updated_at?: string
          visitor_id?: string | null
        }
        Update: {
          branch_id?: string | null
          condition_notes?: string | null
          created_at?: string
          expected_return?: string | null
          id?: string
          is_permanent?: boolean
          issued_at?: string
          issued_by?: string
          issued_to_name?: string
          issued_to_staff_id?: string | null
          issued_to_type?: string
          key_id?: string
          notes?: string | null
          returned_at?: string | null
          returned_to?: string | null
          supplier_id?: string | null
          updated_at?: string
          visitor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "key_issues_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_issues_issued_to_staff_id_fkey"
            columns: ["issued_to_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_issues_key_id_fkey"
            columns: ["key_id"]
            isOneToOne: false
            referencedRelation: "property_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_issues_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers_min"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_issues_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: false
            referencedRelation: "v_legacy_visitor_visits"
            referencedColumns: ["legacy_visitor_id"]
          },
          {
            foreignKeyName: "key_issues_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: false
            referencedRelation: "visitors"
            referencedColumns: ["id"]
          },
        ]
      }
      kiosk_security: {
        Row: {
          created_at: string
          id: string
          pin_algo: string
          pin_hash: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          pin_algo?: string
          pin_hash: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          pin_algo?: string
          pin_hash?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      leave_requests: {
        Row: {
          branch_id: string | null
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
          branch_id?: string | null
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
          branch_id?: string | null
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
            foreignKeyName: "leave_requests_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: false
            referencedRelation: "v_legacy_visitor_visits"
            referencedColumns: ["legacy_visitor_id"]
          },
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
      organisations: {
        Row: {
          code: string | null
          created_at: string
          id: string
          is_active: boolean
          is_legacy_placeholder: boolean
          jurisdiction: string
          name: string
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_legacy_placeholder?: boolean
          jurisdiction?: string
          name: string
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_legacy_placeholder?: boolean
          jurisdiction?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      people: {
        Row: {
          branch_id: string | null
          created_at: string
          default_person_type: string | null
          email: string | null
          external_id: string | null
          external_source: string | null
          first_name: string
          id: string
          is_active: boolean
          legacy_visitor_id: string | null
          mobile: string | null
          organisation_id: string | null
          person_qr: string | null
          surname: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          default_person_type?: string | null
          email?: string | null
          external_id?: string | null
          external_source?: string | null
          first_name: string
          id?: string
          is_active?: boolean
          legacy_visitor_id?: string | null
          mobile?: string | null
          organisation_id?: string | null
          person_qr?: string | null
          surname: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          default_person_type?: string | null
          email?: string | null
          external_id?: string | null
          external_source?: string | null
          first_name?: string
          id?: string
          is_active?: boolean
          legacy_visitor_id?: string | null
          mobile?: string | null
          organisation_id?: string | null
          person_qr?: string | null
          surname?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "people_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_default_person_type_fkey"
            columns: ["default_person_type"]
            isOneToOne: false
            referencedRelation: "person_types"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "people_legacy_visitor_id_fkey"
            columns: ["legacy_visitor_id"]
            isOneToOne: false
            referencedRelation: "v_legacy_visitor_visits"
            referencedColumns: ["legacy_visitor_id"]
          },
          {
            foreignKeyName: "people_legacy_visitor_id_fkey"
            columns: ["legacy_visitor_id"]
            isOneToOne: false
            referencedRelation: "visitors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      person_types: {
        Row: {
          is_active: boolean
          key: string
          label: string
          sort_order: number
        }
        Insert: {
          is_active?: boolean
          key: string
          label: string
          sort_order?: number
        }
        Update: {
          is_active?: boolean
          key?: string
          label?: string
          sort_order?: number
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
      property_keys: {
        Row: {
          branch_id: string | null
          copy_number: number
          created_at: string
          id: string
          is_active: boolean
          key_label: string
          key_type: string
          lost_at: string | null
          lost_notes: string | null
          notes: string | null
          property_label: string | null
          replaced_by_key_id: string | null
          resident_name: string | null
          resident_visitor_id: string | null
          status: string
          storage_location: string | null
          updated_at: string
          wing_id: string | null
        }
        Insert: {
          branch_id?: string | null
          copy_number?: number
          created_at?: string
          id?: string
          is_active?: boolean
          key_label: string
          key_type?: string
          lost_at?: string | null
          lost_notes?: string | null
          notes?: string | null
          property_label?: string | null
          replaced_by_key_id?: string | null
          resident_name?: string | null
          resident_visitor_id?: string | null
          status?: string
          storage_location?: string | null
          updated_at?: string
          wing_id?: string | null
        }
        Update: {
          branch_id?: string | null
          copy_number?: number
          created_at?: string
          id?: string
          is_active?: boolean
          key_label?: string
          key_type?: string
          lost_at?: string | null
          lost_notes?: string | null
          notes?: string | null
          property_label?: string | null
          replaced_by_key_id?: string | null
          resident_name?: string | null
          resident_visitor_id?: string | null
          status?: string
          storage_location?: string | null
          updated_at?: string
          wing_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_keys_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_keys_replaced_by_key_id_fkey"
            columns: ["replaced_by_key_id"]
            isOneToOne: false
            referencedRelation: "property_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_keys_resident_visitor_id_fkey"
            columns: ["resident_visitor_id"]
            isOneToOne: false
            referencedRelation: "v_legacy_visitor_visits"
            referencedColumns: ["legacy_visitor_id"]
          },
          {
            foreignKeyName: "property_keys_resident_visitor_id_fkey"
            columns: ["resident_visitor_id"]
            isOneToOne: false
            referencedRelation: "visitors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_keys_wing_id_fkey"
            columns: ["wing_id"]
            isOneToOne: false
            referencedRelation: "wings"
            referencedColumns: ["id"]
          },
        ]
      }
      resident_details: {
        Row: {
          branch_id: string | null
          care_level: string | null
          created_at: string | null
          destination_categories: string[] | null
          dols_lps_flag: boolean | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          id: string
          key_worker: string | null
          medication_notes: string | null
          mobility_aids: string[] | null
          mobility_level: string | null
          notes: string | null
          photo_url: string | null
          risk_assessment_level: string | null
          room: string | null
          updated_at: string | null
          visitor_id: string
          wing_id: string | null
        }
        Insert: {
          branch_id?: string | null
          care_level?: string | null
          created_at?: string | null
          destination_categories?: string[] | null
          dols_lps_flag?: boolean | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          id?: string
          key_worker?: string | null
          medication_notes?: string | null
          mobility_aids?: string[] | null
          mobility_level?: string | null
          notes?: string | null
          photo_url?: string | null
          risk_assessment_level?: string | null
          room?: string | null
          updated_at?: string | null
          visitor_id: string
          wing_id?: string | null
        }
        Update: {
          branch_id?: string | null
          care_level?: string | null
          created_at?: string | null
          destination_categories?: string[] | null
          dols_lps_flag?: boolean | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          id?: string
          key_worker?: string | null
          medication_notes?: string | null
          mobility_aids?: string[] | null
          mobility_level?: string | null
          notes?: string | null
          photo_url?: string | null
          risk_assessment_level?: string | null
          room?: string | null
          updated_at?: string | null
          visitor_id?: string
          wing_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "resident_details_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resident_details_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: true
            referencedRelation: "v_legacy_visitor_visits"
            referencedColumns: ["legacy_visitor_id"]
          },
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
      resident_incidents: {
        Row: {
          branch_id: string | null
          created_at: string
          description: string
          expected_return_date: string | null
          id: string
          incident_type: string
          priority: string
          reported_at: string
          reported_by: string
          reported_by_user_id: string | null
          resident_name: string
          resolution_notes: string | null
          resolved_at: string | null
          status: string
          updated_at: string
          visitor_id: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          description: string
          expected_return_date?: string | null
          id?: string
          incident_type?: string
          priority?: string
          reported_at?: string
          reported_by?: string
          reported_by_user_id?: string | null
          resident_name: string
          resolution_notes?: string | null
          resolved_at?: string | null
          status?: string
          updated_at?: string
          visitor_id?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          description?: string
          expected_return_date?: string | null
          id?: string
          incident_type?: string
          priority?: string
          reported_at?: string
          reported_by?: string
          reported_by_user_id?: string | null
          resident_name?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          status?: string
          updated_at?: string
          visitor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "resident_incidents_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resident_incidents_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: false
            referencedRelation: "v_legacy_visitor_visits"
            referencedColumns: ["legacy_visitor_id"]
          },
          {
            foreignKeyName: "resident_incidents_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: false
            referencedRelation: "visitors"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          id: string
          permission: Database["public"]["Enums"]["app_permission"]
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string
          id?: string
          permission: Database["public"]["Enums"]["app_permission"]
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string
          id?: string
          permission?: Database["public"]["Enums"]["app_permission"]
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
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
      settings_scoped: {
        Row: {
          branch_id: string | null
          created_at: string
          id: string
          jurisdiction: string | null
          key: string
          organisation_id: string | null
          person_type: string | null
          role: string | null
          scope_type: string
          updated_at: string
          updated_by: string | null
          value: string
          wing_id: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          id?: string
          jurisdiction?: string | null
          key: string
          organisation_id?: string | null
          person_type?: string | null
          role?: string | null
          scope_type: string
          updated_at?: string
          updated_by?: string | null
          value: string
          wing_id?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          id?: string
          jurisdiction?: string | null
          key?: string
          organisation_id?: string | null
          person_type?: string | null
          role?: string | null
          scope_type?: string
          updated_at?: string
          updated_by?: string | null
          value?: string
          wing_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "settings_scoped_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settings_scoped_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settings_scoped_wing_id_fkey"
            columns: ["wing_id"]
            isOneToOne: false
            referencedRelation: "wings"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_members: {
        Row: {
          branch_id: string | null
          created_at: string
          department: string | null
          email: string | null
          first_name: string
          id: string
          is_active: boolean
          phone: string | null
          role: string
          surname: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          first_name: string
          id?: string
          is_active?: boolean
          phone?: string | null
          role?: string
          surname: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          first_name?: string
          id?: string
          is_active?: boolean
          phone?: string | null
          role?: string
          surname?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_members_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_credentials: {
        Row: {
          created_at: string
          credential_type_id: string
          expiry_date: string | null
          id: string
          reference: string | null
          supplier_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          credential_type_id: string
          expiry_date?: string | null
          id?: string
          reference?: string | null
          supplier_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          credential_type_id?: string
          expiry_date?: string | null
          id?: string
          reference?: string | null
          supplier_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_credentials_credential_type_id_fkey"
            columns: ["credential_type_id"]
            isOneToOne: false
            referencedRelation: "credential_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_credentials_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers_min"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers_min: {
        Row: {
          abn: string | null
          acws_expiry_date: string | null
          acws_reference: string | null
          branch_id: string | null
          company_number: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          dbs_expiry_date: string | null
          dbs_reference: string | null
          id: string
          insurance_expiry_date: string | null
          insurance_reference: string | null
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          abn?: string | null
          acws_expiry_date?: string | null
          acws_reference?: string | null
          branch_id?: string | null
          company_number?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          dbs_expiry_date?: string | null
          dbs_reference?: string | null
          id?: string
          insurance_expiry_date?: string | null
          insurance_reference?: string | null
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          abn?: string | null
          acws_expiry_date?: string | null
          acws_reference?: string | null
          branch_id?: string | null
          company_number?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          dbs_expiry_date?: string | null
          dbs_reference?: string | null
          id?: string
          insurance_expiry_date?: string | null
          insurance_reference?: string | null
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_min_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
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
      user_site_access: {
        Row: {
          branch_id: string
          created_at: string
          id: string
          is_default: boolean
          user_id: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          id?: string
          is_default?: boolean
          user_id: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          id?: string
          is_default?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_site_access_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
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
      visit_parties: {
        Row: {
          check_in_time: string
          check_out_time: string | null
          created_at: string
          display_name: string
          id: string
          is_primary: boolean
          person_id: string | null
          relationship: string | null
          updated_at: string
          visit_id: string
        }
        Insert: {
          check_in_time?: string
          check_out_time?: string | null
          created_at?: string
          display_name: string
          id?: string
          is_primary?: boolean
          person_id?: string | null
          relationship?: string | null
          updated_at?: string
          visit_id: string
        }
        Update: {
          check_in_time?: string
          check_out_time?: string | null
          created_at?: string
          display_name?: string
          id?: string
          is_primary?: boolean
          person_id?: string | null
          relationship?: string | null
          updated_at?: string
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visit_parties_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_parties_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "v_legacy_visitor_visits"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "visit_parties_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "v_legacy_visitor_visits"
            referencedColumns: ["visit_id"]
          },
          {
            foreignKeyName: "visit_parties_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      visit_statuses: {
        Row: {
          is_open: boolean
          key: string
          label: string
        }
        Insert: {
          is_open?: boolean
          key: string
          label: string
        }
        Update: {
          is_open?: boolean
          key?: string
          label?: string
        }
        Relationships: []
      }
      visitor_watchlist: {
        Row: {
          added_by: string
          alert_type: string | null
          branch_id: string | null
          created_at: string | null
          date_of_birth: string | null
          first_name: string
          id: string
          instructions: string | null
          is_active: boolean | null
          photo_url: string | null
          reason: string
          reason_category: string | null
          review_date: string | null
          surname: string
          updated_at: string | null
        }
        Insert: {
          added_by?: string
          alert_type?: string | null
          branch_id?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          first_name: string
          id?: string
          instructions?: string | null
          is_active?: boolean | null
          photo_url?: string | null
          reason: string
          reason_category?: string | null
          review_date?: string | null
          surname: string
          updated_at?: string | null
        }
        Update: {
          added_by?: string
          alert_type?: string | null
          branch_id?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          first_name?: string
          id?: string
          instructions?: string | null
          is_active?: boolean | null
          photo_url?: string | null
          reason?: string
          reason_category?: string | null
          review_date?: string | null
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
          compliance_status: string | null
          contractor_person_id: string | null
          contractor_screening: Json | null
          created_at: string
          email: string
          expected_return_date: string | null
          first_name: string
          group_id: string | null
          health_answers: Json | null
          health_declaration: boolean | null
          id: string
          leave_type: string | null
          legal_hold: boolean
          mobile: string
          person_qr: string | null
          print_status: string | null
          privacy_acknowledged: boolean | null
          qr_code: string | null
          return_notification_opt_in: boolean | null
          safeguarding_hold: boolean | null
          signature_url: string | null
          status: string
          supplier_id: string | null
          surname: string
          type: string
          visit_purpose: string | null
          visited_resident_ids: string[] | null
          whom_to_visit: string | null
          work_location: string | null
          work_type: string | null
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
          compliance_status?: string | null
          contractor_person_id?: string | null
          contractor_screening?: Json | null
          created_at?: string
          email: string
          expected_return_date?: string | null
          first_name: string
          group_id?: string | null
          health_answers?: Json | null
          health_declaration?: boolean | null
          id?: string
          leave_type?: string | null
          legal_hold?: boolean
          mobile: string
          person_qr?: string | null
          print_status?: string | null
          privacy_acknowledged?: boolean | null
          qr_code?: string | null
          return_notification_opt_in?: boolean | null
          safeguarding_hold?: boolean | null
          signature_url?: string | null
          status?: string
          supplier_id?: string | null
          surname: string
          type?: string
          visit_purpose?: string | null
          visited_resident_ids?: string[] | null
          whom_to_visit?: string | null
          work_location?: string | null
          work_type?: string | null
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
          compliance_status?: string | null
          contractor_person_id?: string | null
          contractor_screening?: Json | null
          created_at?: string
          email?: string
          expected_return_date?: string | null
          first_name?: string
          group_id?: string | null
          health_answers?: Json | null
          health_declaration?: boolean | null
          id?: string
          leave_type?: string | null
          legal_hold?: boolean
          mobile?: string
          person_qr?: string | null
          print_status?: string | null
          privacy_acknowledged?: boolean | null
          qr_code?: string | null
          return_notification_opt_in?: boolean | null
          safeguarding_hold?: boolean | null
          signature_url?: string | null
          status?: string
          supplier_id?: string | null
          surname?: string
          type?: string
          visit_purpose?: string | null
          visited_resident_ids?: string[] | null
          whom_to_visit?: string | null
          work_location?: string | null
          work_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visitors_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitors_contractor_person_id_fkey"
            columns: ["contractor_person_id"]
            isOneToOne: false
            referencedRelation: "contractor_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitors_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers_min"
            referencedColumns: ["id"]
          },
        ]
      }
      visits: {
        Row: {
          branch_id: string
          check_in_time: string
          check_out_time: string | null
          created_at: string
          destination_label: string | null
          destination_resident_person_id: string | null
          destination_wing_id: string | null
          group_id: string | null
          id: string
          legacy_visitor_id: string | null
          person_id: string | null
          person_type: string
          source: string
          status: string
          updated_at: string
        }
        Insert: {
          branch_id: string
          check_in_time?: string
          check_out_time?: string | null
          created_at?: string
          destination_label?: string | null
          destination_resident_person_id?: string | null
          destination_wing_id?: string | null
          group_id?: string | null
          id?: string
          legacy_visitor_id?: string | null
          person_id?: string | null
          person_type: string
          source?: string
          status?: string
          updated_at?: string
        }
        Update: {
          branch_id?: string
          check_in_time?: string
          check_out_time?: string | null
          created_at?: string
          destination_label?: string | null
          destination_resident_person_id?: string | null
          destination_wing_id?: string | null
          group_id?: string | null
          id?: string
          legacy_visitor_id?: string | null
          person_id?: string | null
          person_type?: string
          source?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "visits_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_destination_resident_person_id_fkey"
            columns: ["destination_resident_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_destination_resident_person_id_fkey"
            columns: ["destination_resident_person_id"]
            isOneToOne: false
            referencedRelation: "v_legacy_visitor_visits"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "visits_destination_wing_id_fkey"
            columns: ["destination_wing_id"]
            isOneToOne: false
            referencedRelation: "wings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_legacy_visitor_id_fkey"
            columns: ["legacy_visitor_id"]
            isOneToOne: false
            referencedRelation: "v_legacy_visitor_visits"
            referencedColumns: ["legacy_visitor_id"]
          },
          {
            foreignKeyName: "visits_legacy_visitor_id_fkey"
            columns: ["legacy_visitor_id"]
            isOneToOne: false
            referencedRelation: "visitors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "v_legacy_visitor_visits"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "visits_person_type_fkey"
            columns: ["person_type"]
            isOneToOne: false
            referencedRelation: "person_types"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "visits_status_fkey"
            columns: ["status"]
            isOneToOne: false
            referencedRelation: "visit_statuses"
            referencedColumns: ["key"]
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
      v_legacy_visitor_visits: {
        Row: {
          branch_id: string | null
          check_in_time: string | null
          check_out_time: string | null
          group_id: string | null
          legacy_visitor_id: string | null
          person_id: string | null
          person_type: string | null
          status: string | null
          visit_id: string | null
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
    }
    Functions: {
      current_user_site_ids: { Args: never; Returns: string[] }
      default_site_id: { Args: never; Returns: string }
      ensure_user_bootstrap: { Args: never; Returns: undefined }
      has_permission: {
        Args: {
          _permission: Database["public"]["Enums"]["app_permission"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      kiosk_check_in: {
        Args: { p_payload: Json }
        Returns: {
          qr_code: string
          visitor_id: string
        }[]
      }
      kiosk_check_out: {
        Args: { p_time?: string; p_visitor_id: string }
        Returns: boolean
      }
      kiosk_contractor_lookup: {
        Args: {
          p_first?: string
          p_last?: string
          p_mobile?: string
          p_qr?: string
        }
        Returns: {
          first_name: string
          outstanding_credentials: string[]
          person_id: string
          supplier_id: string
          supplier_name: string
          surname: string
        }[]
      }
      kiosk_pin_is_set: { Args: never; Returns: boolean }
      kiosk_prefill_visitor: {
        Args: { p_first: string; p_last: string }
        Returns: {
          address: string
          email: string
          mobile: string
          whom_to_visit: string
        }[]
      }
      kiosk_presence_list: {
        Args: never
        Returns: {
          accompanied_by_name: string
          additional_visitors: number
          check_in_time: string
          check_out_time: string
          expected_return_date: string
          first_name: string
          group_id: string
          id: string
          leave_type: string
          qr_code: string
          status: string
          surname: string
          type: string
          whom_to_visit: string
        }[]
      }
      kiosk_resident_directory: {
        Args: { p_search?: string }
        Returns: {
          area_name: string
          first_name: string
          room: string
          status: string
          surname: string
          visitor_id: string
        }[]
      }
      kiosk_resident_leave: {
        Args: {
          p_accompanied_by_name?: string
          p_expected_return?: string
          p_leave_type?: string
          p_reason?: string
          p_time?: string
          p_visitor_id: string
        }
        Returns: boolean
      }
      kiosk_resident_return: {
        Args: { p_time?: string; p_visitor_id: string }
        Returns: boolean
      }
      kiosk_returning_lookup: {
        Args: {
          p_first?: string
          p_last?: string
          p_mobile?: string
          p_qr?: string
        }
        Returns: {
          address: string
          email: string
          first_name: string
          last_visit: string
          mobile: string
          person_qr: string
          surname: string
          visited_resident_ids: string[]
          whom_to_visit: string
        }[]
      }
      kiosk_staff_directory: {
        Args: { p_search?: string }
        Returns: {
          department: string
          first_name: string
          id: string
          surname: string
        }[]
      }
      kiosk_supplier_directory: {
        Args: never
        Returns: {
          id: string
          name: string
        }[]
      }
      kiosk_watchlist_check: {
        Args: { p_first: string; p_last: string }
        Returns: {
          alert_type: string
          is_match: boolean
        }[]
      }
      log_audit: {
        Args: {
          _action: string
          _details?: Json
          _reason?: string
          _records?: number
        }
        Returns: string
      }
      resolve_setting: {
        Args: {
          p_branch_id?: string
          p_jurisdiction?: string
          p_key: string
          p_person_type?: string
          p_role?: string
          p_wing_id?: string
        }
        Returns: string
      }
      set_kiosk_pin: { Args: { p_pin: string }; Returns: undefined }
      user_can_access_site: { Args: { _branch_id: string }; Returns: boolean }
      verify_kiosk_pin: { Args: { p_pin: string }; Returns: boolean }
    }
    Enums: {
      app_permission:
        | "presence.view"
        | "checkin.create"
        | "checkout.perform"
        | "person.edit"
        | "screening.view"
        | "assistance.view"
        | "credentials.view"
        | "emergency.activate"
        | "emergency.mark_safe"
        | "emergency.export"
        | "watchlist.manage"
        | "privacy.manage"
        | "data.export"
        | "data.erase"
        | "settings.administer"
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
    Enums: {
      app_permission: [
        "presence.view",
        "checkin.create",
        "checkout.perform",
        "person.edit",
        "screening.view",
        "assistance.view",
        "credentials.view",
        "emergency.activate",
        "emergency.mark_safe",
        "emergency.export",
        "watchlist.manage",
        "privacy.manage",
        "data.export",
        "data.erase",
        "settings.administer",
      ],
      app_role: ["admin", "staff", "user"],
    },
  },
} as const
