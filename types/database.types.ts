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
      admin_actions_log: {
        Row: {
          action_type: string
          admin_id: string
          created_at: string
          details: Json | null
          id: string
          target_resource_id: string | null
          target_user_id: string | null
        }
        Insert: {
          action_type: string
          admin_id: string
          created_at?: string
          details?: Json | null
          id?: string
          target_resource_id?: string | null
          target_user_id?: string | null
        }
        Update: {
          action_type?: string
          admin_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          target_resource_id?: string | null
          target_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_actions_log_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_actions_log_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      angle_choices: {
        Row: {
          angle_question_id: string
          choice_text: string
          created_at: string
          display_order: number
          distractor_analysis: string | null
          id: string
          is_correct: boolean
          letter: string
        }
        Insert: {
          angle_question_id: string
          choice_text: string
          created_at?: string
          display_order: number
          distractor_analysis?: string | null
          id?: string
          is_correct?: boolean
          letter: string
        }
        Update: {
          angle_question_id?: string
          choice_text?: string
          created_at?: string
          display_order?: number
          distractor_analysis?: string | null
          id?: string
          is_correct?: boolean
          letter?: string
        }
        Relationships: [
          {
            foreignKeyName: "angle_choices_angle_question_id_fkey"
            columns: ["angle_question_id"]
            isOneToOne: false
            referencedRelation: "angle_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      angle_questions: {
        Row: {
          angle_letter: string
          angle_title: string | null
          common_pitfall: string
          concepts_and_skills: Json
          created_at: string
          display_order: number
          full_explanation: string
          id: string
          legal_topic_analysis: string
          question_text: string
          quick_thinking_360: string
          references_list: Json
          source_question_id: string
          summary_for_memory: string
          updated_at: string
        }
        Insert: {
          angle_letter: string
          angle_title?: string | null
          common_pitfall: string
          concepts_and_skills?: Json
          created_at?: string
          display_order: number
          full_explanation: string
          id?: string
          legal_topic_analysis: string
          question_text: string
          quick_thinking_360: string
          references_list?: Json
          source_question_id: string
          summary_for_memory: string
          updated_at?: string
        }
        Update: {
          angle_letter?: string
          angle_title?: string | null
          common_pitfall?: string
          concepts_and_skills?: Json
          created_at?: string
          display_order?: number
          full_explanation?: string
          id?: string
          legal_topic_analysis?: string
          question_text?: string
          quick_thinking_360?: string
          references_list?: Json
          source_question_id?: string
          summary_for_memory?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "angle_questions_source_question_id_fkey"
            columns: ["source_question_id"]
            isOneToOne: false
            referencedRelation: "source_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      attempts: {
        Row: {
          angle_question_id: string | null
          attempted_at: string
          duration_seconds: number | null
          exam_session_id: string | null
          id: string
          is_correct: boolean | null
          mode: string
          practice_session_id: string | null
          question_type: string
          selected_choice_id: string | null
          selected_letter: string | null
          source_question_id: string | null
          user_id: string
          was_skipped: boolean
        }
        Insert: {
          angle_question_id?: string | null
          attempted_at?: string
          duration_seconds?: number | null
          exam_session_id?: string | null
          id?: string
          is_correct?: boolean | null
          mode: string
          practice_session_id?: string | null
          question_type: string
          selected_choice_id?: string | null
          selected_letter?: string | null
          source_question_id?: string | null
          user_id: string
          was_skipped?: boolean
        }
        Update: {
          angle_question_id?: string | null
          attempted_at?: string
          duration_seconds?: number | null
          exam_session_id?: string | null
          id?: string
          is_correct?: boolean | null
          mode?: string
          practice_session_id?: string | null
          question_type?: string
          selected_choice_id?: string | null
          selected_letter?: string | null
          source_question_id?: string | null
          user_id?: string
          was_skipped?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "attempts_angle_question_id_fkey"
            columns: ["angle_question_id"]
            isOneToOne: false
            referencedRelation: "angle_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempts_exam_session_id_fkey"
            columns: ["exam_session_id"]
            isOneToOne: false
            referencedRelation: "exam_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempts_practice_session_id_fkey"
            columns: ["practice_session_id"]
            isOneToOne: false
            referencedRelation: "practice_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempts_source_question_id_fkey"
            columns: ["source_question_id"]
            isOneToOne: false
            referencedRelation: "source_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bookmarks: {
        Row: {
          angle_question_id: string | null
          created_at: string
          id: string
          question_type: string
          source_question_group_id: string | null
          user_id: string
        }
        Insert: {
          angle_question_id?: string | null
          created_at?: string
          id?: string
          question_type: string
          source_question_group_id?: string | null
          user_id: string
        }
        Update: {
          angle_question_id?: string | null
          created_at?: string
          id?: string
          question_type?: string
          source_question_group_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookmarks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chapters: {
        Row: {
          code: string
          created_at: string
          display_order: number
          id: string
          title: string
        }
        Insert: {
          code: string
          created_at?: string
          display_order: number
          id?: string
          title: string
        }
        Update: {
          code?: string
          created_at?: string
          display_order?: number
          id?: string
          title?: string
        }
        Relationships: []
      }
      exam_sessions: {
        Row: {
          active_window_token: string | null
          completed_at: string | null
          final_score: number | null
          id: string
          last_activity_at: string
          passed: boolean | null
          paused_at: string | null
          question_list: Json
          questions_answered: number
          questions_correct: number
          started_at: string
          status: string
          time_used_seconds: number
          total_duration_seconds: number
          user_id: string
        }
        Insert: {
          active_window_token?: string | null
          completed_at?: string | null
          final_score?: number | null
          id?: string
          last_activity_at?: string
          passed?: boolean | null
          paused_at?: string | null
          question_list: Json
          questions_answered?: number
          questions_correct?: number
          started_at?: string
          status?: string
          time_used_seconds?: number
          total_duration_seconds?: number
          user_id: string
        }
        Update: {
          active_window_token?: string | null
          completed_at?: string | null
          final_score?: number | null
          id?: string
          last_activity_at?: string
          passed?: boolean | null
          paused_at?: string | null
          question_list?: Json
          questions_answered?: number
          questions_correct?: number
          started_at?: string
          status?: string
          time_used_seconds?: number
          total_duration_seconds?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mistakes: {
        Row: {
          angle_question_id: string | null
          first_mistake_at: string
          id: string
          last_mistake_at: string
          manually_removed: boolean
          mistakes_count: number
          question_type: string
          removed_at: string | null
          source_question_group_id: string | null
          user_id: string
        }
        Insert: {
          angle_question_id?: string | null
          first_mistake_at?: string
          id?: string
          last_mistake_at?: string
          manually_removed?: boolean
          mistakes_count?: number
          question_type: string
          removed_at?: string | null
          source_question_group_id?: string | null
          user_id: string
        }
        Update: {
          angle_question_id?: string | null
          first_mistake_at?: string
          id?: string
          last_mistake_at?: string
          manually_removed?: boolean
          mistakes_count?: number
          question_type?: string
          removed_at?: string | null
          source_question_group_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mistakes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_ils: number
          created_at: string
          id: string
          invoice_url: string | null
          payment_provider: string
          plan_type: string
          provider_transaction_id: string | null
          status: string
          updated_at: string
          user_id: string
          vat_included: boolean
        }
        Insert: {
          amount_ils: number
          created_at?: string
          id?: string
          invoice_url?: string | null
          payment_provider: string
          plan_type: string
          provider_transaction_id?: string | null
          status: string
          updated_at?: string
          user_id: string
          vat_included?: boolean
        }
        Update: {
          amount_ils?: number
          created_at?: string
          id?: string
          invoice_url?: string | null
          payment_provider?: string
          plan_type?: string
          provider_transaction_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          vat_included?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_sessions: {
        Row: {
          angles_per_source: number
          completed_at: string | null
          id: string
          last_activity_at: string
          question_list: Json
          questions_answered: number
          questions_correct: number
          selected_chapters: Json
          selected_subtopics: Json
          source_count_target: number
          started_at: string
          status: string
          time_per_question_seconds: number
          user_id: string
        }
        Insert: {
          angles_per_source?: number
          completed_at?: string | null
          id?: string
          last_activity_at?: string
          question_list: Json
          questions_answered?: number
          questions_correct?: number
          selected_chapters?: Json
          selected_subtopics?: Json
          source_count_target: number
          started_at?: string
          status?: string
          time_per_question_seconds?: number
          user_id: string
        }
        Update: {
          angles_per_source?: number
          completed_at?: string | null
          id?: string
          last_activity_at?: string
          question_list?: Json
          questions_answered?: number
          questions_correct?: number
          selected_chapters?: Json
          selected_subtopics?: Json
          source_count_target?: number
          started_at?: string
          status?: string
          time_per_question_seconds?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          birth_date: string
          created_at: string
          exam_date_planned: string | null
          full_name: string
          gender: string
          id: string
          is_admin: boolean
          phone: string | null
          signup_source: string
          terms_accepted_at: string
          updated_at: string
        }
        Insert: {
          birth_date: string
          created_at?: string
          exam_date_planned?: string | null
          full_name: string
          gender: string
          id: string
          is_admin?: boolean
          phone?: string | null
          signup_source: string
          terms_accepted_at: string
          updated_at?: string
        }
        Update: {
          birth_date?: string
          created_at?: string
          exam_date_planned?: string | null
          full_name?: string
          gender?: string
          id?: string
          is_admin?: boolean
          phone?: string | null
          signup_source?: string
          terms_accepted_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      question_feedback: {
        Row: {
          angle_position: number | null
          category: string
          created_at: string
          id: string
          message: string
          question_type: string
          source_question_group_id: string
          user_id: string
        }
        Insert: {
          angle_position?: number | null
          category: string
          created_at?: string
          id?: string
          message: string
          question_type: string
          source_question_group_id: string
          user_id: string
        }
        Update: {
          angle_position?: number | null
          category?: string
          created_at?: string
          id?: string
          message?: string
          question_type?: string
          source_question_group_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      question_notes: {
        Row: {
          angle_position: number | null
          content_html: string
          content_json: Json
          created_at: string
          id: string
          question_type: string
          source_question_group_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          angle_position?: number | null
          content_html: string
          content_json: Json
          created_at?: string
          id?: string
          question_type: string
          source_question_group_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          angle_position?: number | null
          content_html?: string
          content_json?: Json
          created_at?: string
          id?: string
          question_type?: string
          source_question_group_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_notes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      source_choices: {
        Row: {
          choice_text: string
          created_at: string
          display_order: number
          distractor_analysis: string | null
          id: string
          is_correct: boolean
          letter: string
          source_question_id: string
        }
        Insert: {
          choice_text: string
          created_at?: string
          display_order: number
          distractor_analysis?: string | null
          id?: string
          is_correct?: boolean
          letter: string
          source_question_id: string
        }
        Update: {
          choice_text?: string
          created_at?: string
          display_order?: number
          distractor_analysis?: string | null
          id?: string
          is_correct?: boolean
          letter?: string
          source_question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_choices_source_question_id_fkey"
            columns: ["source_question_id"]
            isOneToOne: false
            referencedRelation: "source_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      source_questions: {
        Row: {
          chapter_id: string
          common_pitfall: string
          concepts_and_skills: Json
          created_at: string
          created_by: string
          external_id: string
          full_explanation: string
          id: string
          is_current: boolean
          legal_topic_analysis: string
          notes_for_admin: string | null
          question_group_id: string
          question_text: string
          quick_thinking_360: string
          references_list: Json
          source_metadata: Json | null
          status: string
          subtopic_id: string
          summary_for_memory: string
          updated_at: string
          version: number
        }
        Insert: {
          chapter_id: string
          common_pitfall: string
          concepts_and_skills?: Json
          created_at?: string
          created_by: string
          external_id: string
          full_explanation: string
          id?: string
          is_current?: boolean
          legal_topic_analysis: string
          notes_for_admin?: string | null
          question_group_id: string
          question_text: string
          quick_thinking_360: string
          references_list?: Json
          source_metadata?: Json | null
          status?: string
          subtopic_id: string
          summary_for_memory: string
          updated_at?: string
          version?: number
        }
        Update: {
          chapter_id?: string
          common_pitfall?: string
          concepts_and_skills?: Json
          created_at?: string
          created_by?: string
          external_id?: string
          full_explanation?: string
          id?: string
          is_current?: boolean
          legal_topic_analysis?: string
          notes_for_admin?: string | null
          question_group_id?: string
          question_text?: string
          quick_thinking_360?: string
          references_list?: Json
          source_metadata?: Json | null
          status?: string
          subtopic_id?: string
          summary_for_memory?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "source_questions_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_questions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_questions_subtopic_id_fkey"
            columns: ["subtopic_id"]
            isOneToOne: false
            referencedRelation: "subtopics"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          admin_notes: string | null
          cancelled_at: string | null
          created_at: string
          ends_at: string
          granted_by_admin: string | null
          id: string
          is_current: boolean
          payment_id: string | null
          plan_type: string
          starts_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          cancelled_at?: string | null
          created_at?: string
          ends_at: string
          granted_by_admin?: string | null
          id?: string
          is_current?: boolean
          payment_id?: string | null
          plan_type: string
          starts_at: string
          status: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          cancelled_at?: string | null
          created_at?: string
          ends_at?: string
          granted_by_admin?: string | null
          id?: string
          is_current?: boolean
          payment_id?: string | null
          plan_type?: string
          starts_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_granted_by_admin_fkey"
            columns: ["granted_by_admin"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subtopics: {
        Row: {
          chapter_id: string
          code: string
          created_at: string
          display_order: number
          id: string
          title: string
        }
        Insert: {
          chapter_id: string
          code: string
          created_at?: string
          display_order: number
          id?: string
          title: string
        }
        Update: {
          chapter_id?: string
          code?: string
          created_at?: string
          display_order?: number
          id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "subtopics_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_idempotency_log: {
        Row: {
          idempotency_key: string
          processed_at: string
          result: Json
          webhook_source: string
        }
        Insert: {
          idempotency_key: string
          processed_at?: string
          result: Json
          webhook_source: string
        }
        Update: {
          idempotency_key?: string
          processed_at?: string
          result?: Json
          webhook_source?: string
        }
        Relationships: []
      }
    }
    Views: {
      mv_admin_dashboard_metrics: {
        Row: {
          active_users_30d: number | null
          avg_time_per_question: number | null
          computed_at: string | null
          correct_attempts: number | null
          total_attempts: number | null
          total_users: number | null
        }
        Relationships: []
      }
      mv_question_difficulty: {
        Row: {
          correct_attempts: number | null
          question_id: string | null
          question_type: string | null
          success_rate: number | null
          total_attempts: number | null
        }
        Relationships: []
      }
      mv_user_chapter_stats: {
        Row: {
          chapter_id: string | null
          correct_attempts: number | null
          last_attempted_at: string | null
          success_rate: number | null
          total_attempts: number | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      has_active_subscription: { Args: never; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
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

