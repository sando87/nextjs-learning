export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      comments: {
        Row: {
          author_name: string | null
          created_at: string
          id: string
          slug: string
          text: string
          user_id: string | null
        }
        Insert: {
          author_name?: string | null
          created_at?: string
          id?: string
          slug: string
          text: string
          user_id?: string | null
        }
        Update: {
          author_name?: string | null
          created_at?: string
          id?: string
          slug?: string
          text?: string
          user_id?: string | null
        }
        Relationships: []
      }
      health_check: {
        Row: {
          created_at: string
          id: number
          last_viewed_at: string | null
          message: string
          type: number
        }
        Insert: {
          created_at?: string
          id?: never
          last_viewed_at?: string | null
          message?: string
          type?: number
        }
        Update: {
          created_at?: string
          id?: never
          last_viewed_at?: string | null
          message?: string
          type?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          email: string
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      project_members: {
        Row: {
          id: string
          joined_at: string
          project_id: string
          role: Database["public"]["Enums"]["project_role"]
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          project_id: string
          role?: Database["public"]["Enums"]["project_role"]
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          project_id?: string
          role?: Database["public"]["Enums"]["project_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_project_id_fkey"
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
          id: string
          name: string
          owner_id: string
          start_date: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          start_date?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          start_date?: string
        }
        Relationships: []
      }
      tags: {
        Row: {
          color: string
          id: string
          name: string
          project_id: string
        }
        Insert: {
          color?: string
          id?: string
          name: string
          project_id: string
        }
        Update: {
          color?: string
          id?: string
          name?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      task_links: {
        Row: {
          id: string
          source_task_id: string
          target_task_id: string
        }
        Insert: {
          id?: string
          source_task_id: string
          target_task_id: string
        }
        Update: {
          id?: string
          source_task_id?: string
          target_task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_links_source_task_id_fkey"
            columns: ["source_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_links_target_task_id_fkey"
            columns: ["target_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_tags: {
        Row: {
          tag_id: string
          task_id: string
        }
        Insert: {
          tag_id: string
          task_id: string
        }
        Update: {
          tag_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_tags_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assignee_id: string | null
          created_at: string
          end_date: string | null
          id: string
          priority: number
          project_id: string
          sort_order: number
          start_date: string | null
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          priority?: number
          project_id: string
          sort_order?: number
          start_date?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          priority?: number
          project_id?: string
          sort_order?: number
          start_date?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assignee_profiles_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_project_member: { Args: { p_project_id: string }; Returns: boolean }
      is_project_owner: { Args: { p_project_id: string }; Returns: boolean }
    }
    Enums: {
      project_role: "owner" | "member"
      task_status: "planned" | "doing" | "done" | "hold"
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
      project_role: ["owner", "member"],
      task_status: ["planned", "doing", "done", "hold"],
    },
  },
} as const

