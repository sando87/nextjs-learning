export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      health_check: {
        Row: {
          id: number;
          message: string;
          created_at: string;
        };
        Insert: {
          id?: never;
          message?: string;
          created_at?: string;
        };
        Update: {
          id?: never;
          message?: string;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
