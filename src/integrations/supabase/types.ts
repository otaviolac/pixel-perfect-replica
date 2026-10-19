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
      admin_access_grants: {
        Row: {
          granted_at: string
          granted_by: string | null
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          area: string
          created_at: string
          details: Json | null
          entity: string | null
          entity_id: string | null
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          area?: string
          created_at?: string
          details?: Json | null
          entity?: string | null
          entity_id?: string | null
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          area?: string
          created_at?: string
          details?: Json | null
          entity?: string | null
          entity_id?: string | null
          id?: string
        }
        Relationships: []
      }
      competition_dates: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string | null
          id: string
          location: string | null
          name: string
          starts_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          location?: string | null
          name: string
          starts_at: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          location?: string | null
          name?: string
          starts_at?: string
        }
        Relationships: []
      }
      feature_flags: {
        Row: {
          enabled: boolean
          key: string
          label: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          enabled?: boolean
          key: string
          label: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          enabled?: boolean
          key?: string
          label?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      memberships: {
        Row: {
          role: Database["public"]["Enums"]["operational_role"]
          sector_id: number
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          role?: Database["public"]["Enums"]["operational_role"]
          sector_id: number
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          role?: Database["public"]["Enums"]["operational_role"]
          sector_id?: number
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          read_at: string | null
          task_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          read_at?: string | null
          task_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          read_at?: string | null
          task_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          birth_date: string | null
          course: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          joined_at: string | null
          phone: string | null
          photo_path: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          birth_date?: string | null
          course?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id: string
          joined_at?: string | null
          phone?: string | null
          photo_path?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          birth_date?: string | null
          course?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          joined_at?: string | null
          phone?: string | null
          photo_path?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      role_change_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          new_role: Database["public"]["Enums"]["operational_role"] | null
          new_sector: number | null
          old_role: Database["public"]["Enums"]["operational_role"] | null
          old_sector: number | null
          user_id: string
          via_admin: boolean
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_role?: Database["public"]["Enums"]["operational_role"] | null
          new_sector?: number | null
          old_role?: Database["public"]["Enums"]["operational_role"] | null
          old_sector?: number | null
          user_id: string
          via_admin?: boolean
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_role?: Database["public"]["Enums"]["operational_role"] | null
          new_sector?: number | null
          old_role?: Database["public"]["Enums"]["operational_role"] | null
          old_sector?: number | null
          user_id?: string
          via_admin?: boolean
        }
        Relationships: []
      }
      sectors: {
        Row: {
          id: number
          name: string
          slug: string
        }
        Insert: {
          id: number
          name: string
          slug: string
        }
        Update: {
          id?: number
          name?: string
          slug?: string
        }
        Relationships: []
      }
      task_collaborations: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          note: string
          requested_by: string
          sector_id: number
          status: string
          task_id: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          note?: string
          requested_by: string
          sector_id: number
          status?: string
          task_id: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          note?: string
          requested_by?: string
          sector_id?: number
          status?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_collaborations_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_collaborations_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_collaborations_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_collaborations_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          task_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          task_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_dependencies: {
        Row: {
          depends_on: string
          task_id: string
        }
        Insert: {
          depends_on: string
          task_id: string
        }
        Update: {
          depends_on?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_dependencies_depends_on_fkey"
            columns: ["depends_on"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_dependencies_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_history: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          details: Json
          id: string
          task_id: string
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          details?: Json
          id?: string
          task_id: string
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          details?: Json
          id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_history_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_history_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_items: {
        Row: {
          assignee_id: string | null
          created_at: string
          id: string
          status: string
          task_id: string
          title: string
        }
        Insert: {
          assignee_id?: string | null
          created_at?: string
          id?: string
          status?: string
          task_id: string
          title: string
        }
        Update: {
          assignee_id?: string | null
          created_at?: string
          id?: string
          status?: string
          task_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_items_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_items_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_participants: {
        Row: {
          joined_at: string
          status: string
          task_id: string
          user_id: string
        }
        Insert: {
          joined_at?: string
          status?: string
          task_id: string
          user_id: string
        }
        Update: {
          joined_at?: string
          status?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_participants_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          archived_at: string | null
          capacity: number | null
          created_at: string
          created_by: string
          description: string
          due_at: string | null
          execution: string
          id: string
          invited_sectors: number[]
          kind: string
          owner_id: string
          priority: string
          recurring: boolean
          sector_id: number
          status: string
          title: string
          updated_at: string
          whole_sector: boolean
        }
        Insert: {
          archived_at?: string | null
          capacity?: number | null
          created_at?: string
          created_by: string
          description?: string
          due_at?: string | null
          execution?: string
          id?: string
          invited_sectors?: number[]
          kind: string
          owner_id: string
          priority?: string
          recurring?: boolean
          sector_id: number
          status?: string
          title: string
          updated_at?: string
          whole_sector?: boolean
        }
        Update: {
          archived_at?: string | null
          capacity?: number | null
          created_at?: string
          created_by?: string
          description?: string
          due_at?: string | null
          execution?: string
          id?: string
          invited_sectors?: number[]
          kind?: string
          owner_id?: string
          priority?: string
          recurring?: boolean
          sector_id?: number
          status?: string
          title?: string
          updated_at?: string
          whole_sector?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      team_settings: {
        Row: {
          id: boolean
          logo_path: string | null
          team_name: string
          updated_at: string
        }
        Insert: {
          id?: boolean
          logo_path?: string | null
          team_name?: string
          updated_at?: string
        }
        Update: {
          id?: boolean
          logo_path?: string | null
          team_name?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_active_member: { Args: { _uid: string }; Returns: boolean }
      is_admin: { Args: { _uid: string }; Returns: boolean }
      is_captain: { Args: { _uid: string }; Returns: boolean }
      task_command: {
        Args: { _action: string; _data?: Json; _task?: string }
        Returns: string
      }
      task_execute: { Args: { _task: string; _uid: string }; Returns: boolean }
      task_manage: { Args: { _task: string; _uid: string }; Returns: boolean }
      task_visible: { Args: { _task: string; _uid: string }; Returns: boolean }
    }
    Enums: {
      operational_role: "trainee" | "membro" | "gerente" | "capitao"
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
      operational_role: ["trainee", "membro", "gerente", "capitao"],
    },
  },
} as const
