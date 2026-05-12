export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      experiments: {
        Row: {
          id: string
          number: number
          strain: string
          start_date: string
          test_count: number
          repetition_count: number
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          number: number
          strain: string
          start_date: string
          test_count: number
          repetition_count: number
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          number?: number
          strain?: string
          start_date?: string
          test_count?: number
          repetition_count?: number
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "experiments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          user_id: string
          full_name: string | null
          role: string
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          full_name?: string | null
          role?: string
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          full_name?: string | null
          role?: string
          status?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      test_photos: {
        Row: {
          id: string
          test_id: string
          day: number
          storage_path: string
          created_at: string
          kind: string
          photo_index: number
        }
        Insert: {
          id?: string
          test_id: string
          day: number
          storage_path: string
          created_at?: string
          kind?: string
          photo_index: number
        }
        Update: {
          id?: string
          test_id?: string
          day?: number
          storage_path?: string
          created_at?: string
          kind?: string
          photo_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "test_photos_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
      }
      tests: {
        Row: {
          id: string
          experiment_id: string
          repetition_number: number
          test_number: number
          unit: string | null
          requisition: string | null
          test_type: string | null
          test_lot: string | null
          matrix_lot: string | null
          strain: string | null
          mp_lot: string | null
          average_humidity: number | null
          bozo: number | null
          sensorial: number | null
          quantity: number | null
          temp7_chamber: number | null
          temp14_chamber: number | null
          temp7_rice: number | null
          temp14_rice: number | null
          wet_weight: number | null
          dry_weight: number | null
          extracted_conidium_weight: number | null
          date_7_day: string | null
          date_14_day: string | null
          annotations_7_day: Json | null
          annotations_14_day: Json | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          experiment_id: string
          repetition_number: number
          test_number: number
          unit?: string | null
          requisition?: string | null
          test_type?: string | null
          test_lot?: string | null
          matrix_lot?: string | null
          strain?: string | null
          mp_lot?: string | null
          average_humidity?: number | null
          bozo?: number | null
          sensorial?: number | null
          quantity?: number | null
          temp7_chamber?: number | null
          temp14_chamber?: number | null
          temp7_rice?: number | null
          temp14_rice?: number | null
          wet_weight?: number | null
          dry_weight?: number | null
          extracted_conidium_weight?: number | null
          date_7_day?: string | null
          date_14_day?: string | null
          annotations_7_day?: Json | null
          annotations_14_day?: Json | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          experiment_id?: string
          repetition_number?: number
          test_number?: number
          unit?: string | null
          requisition?: string | null
          test_type?: string | null
          test_lot?: string | null
          matrix_lot?: string | null
          strain?: string | null
          mp_lot?: string | null
          average_humidity?: number | null
          bozo?: number | null
          sensorial?: number | null
          quantity?: number | null
          temp7_chamber?: number | null
          temp14_chamber?: number | null
          temp7_rice?: number | null
          temp14_rice?: number | null
          wet_weight?: number | null
          dry_weight?: number | null
          extracted_conidium_weight?: number | null
          date_7_day?: string | null
          date_14_day?: string | null
          annotations_7_day?: Json | null
          annotations_14_day?: Json | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tests_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tests_experiment_id_fkey"
            columns: ["experiment_id"]
            isOneToOne: false
            referencedRelation: "experiments"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
