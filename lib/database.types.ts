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
      audit_logs: {
        Row: {
          id: string
          created_at: string
          actor_user_id: string | null
          actor_name: string | null
          actor_email: string | null
          action: string
          entity_type: string
          entity_id: string | null
          entity_label: string | null
          summary: string
          changes: Json
          metadata: Json
          ip_address: string | null
          user_agent: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          actor_user_id?: string | null
          actor_name?: string | null
          actor_email?: string | null
          action: string
          entity_type: string
          entity_id?: string | null
          entity_label?: string | null
          summary: string
          changes?: Json
          metadata?: Json
          ip_address?: string | null
          user_agent?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          actor_user_id?: string | null
          actor_name?: string | null
          actor_email?: string | null
          action?: string
          entity_type?: string
          entity_id?: string | null
          entity_label?: string | null
          summary?: string
          changes?: Json
          metadata?: Json
          ip_address?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      experiments: {
        Row: {
          id: string
          number: number
          strain: string
          fungus_id: string | null
          strain_acronym: string | null
          strain_variable: string | null
          strain_observation: string | null
          status: string
          canceled_at: string | null
          canceled_by: string | null
          start_date: string
          test_count: number
          repetition_count: number
          created_by: string | null
          created_at: string
          updated_by: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          number: number
          strain: string
          fungus_id?: string | null
          strain_acronym?: string | null
          strain_variable?: string | null
          strain_observation?: string | null
          status?: string
          canceled_at?: string | null
          canceled_by?: string | null
          start_date: string
          test_count: number
          repetition_count: number
          created_by?: string | null
          created_at?: string
          updated_by?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          number?: number
          strain?: string
          fungus_id?: string | null
          strain_acronym?: string | null
          strain_variable?: string | null
          strain_observation?: string | null
          status?: string
          canceled_at?: string | null
          canceled_by?: string | null
          start_date?: string
          test_count?: number
          repetition_count?: number
          created_by?: string | null
          created_at?: string
          updated_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "experiments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "experiments_fungus_id_fkey"
            columns: ["fungus_id"]
            isOneToOne: false
            referencedRelation: "fungi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "experiments_updated_by_fkey"
            columns: ["updated_by"]
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
          created_by: string | null
          created_at: string
          kind: string
          photo_index: number
        }
        Insert: {
          id?: string
          test_id: string
          day: number
          storage_path: string
          created_by?: string | null
          created_at?: string
          kind?: string
          photo_index: number
        }
        Update: {
          id?: string
          test_id?: string
          day?: number
          storage_path?: string
          created_by?: string | null
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
          {
            foreignKeyName: "test_photos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
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
          temp1_chamber: number | null
          temp1_rice: number | null
          temp1_rice_morning_t1: number | null
          temp1_rice_morning_t2: number | null
          temp1_rice_morning_t3: number | null
          temp1_rice_afternoon_t1: number | null
          temp1_rice_afternoon_t2: number | null
          temp1_rice_afternoon_t3: number | null
          temp2_chamber: number | null
          temp2_rice: number | null
          temp2_rice_morning_t1: number | null
          temp2_rice_morning_t2: number | null
          temp2_rice_morning_t3: number | null
          temp2_rice_afternoon_t1: number | null
          temp2_rice_afternoon_t2: number | null
          temp2_rice_afternoon_t3: number | null
          temp3_chamber: number | null
          temp3_rice: number | null
          temp3_rice_morning_t1: number | null
          temp3_rice_morning_t2: number | null
          temp3_rice_morning_t3: number | null
          temp3_rice_afternoon_t1: number | null
          temp3_rice_afternoon_t2: number | null
          temp3_rice_afternoon_t3: number | null
          temp4_chamber: number | null
          temp4_rice: number | null
          temp4_rice_morning_t1: number | null
          temp4_rice_morning_t2: number | null
          temp4_rice_morning_t3: number | null
          temp4_rice_afternoon_t1: number | null
          temp4_rice_afternoon_t2: number | null
          temp4_rice_afternoon_t3: number | null
          temp5_chamber: number | null
          temp5_rice: number | null
          temp5_rice_morning_t1: number | null
          temp5_rice_morning_t2: number | null
          temp5_rice_morning_t3: number | null
          temp5_rice_afternoon_t1: number | null
          temp5_rice_afternoon_t2: number | null
          temp5_rice_afternoon_t3: number | null
          temp6_chamber: number | null
          temp6_rice: number | null
          temp6_rice_morning_t1: number | null
          temp6_rice_morning_t2: number | null
          temp6_rice_morning_t3: number | null
          temp6_rice_afternoon_t1: number | null
          temp6_rice_afternoon_t2: number | null
          temp6_rice_afternoon_t3: number | null
          temp7_chamber: number | null
          temp7_rice: number | null
          temp7_rice_morning_t1: number | null
          temp7_rice_morning_t2: number | null
          temp7_rice_morning_t3: number | null
          temp7_rice_afternoon_t1: number | null
          temp7_rice_afternoon_t2: number | null
          temp7_rice_afternoon_t3: number | null
          temp8_chamber: number | null
          temp8_rice: number | null
          temp8_rice_morning_t1: number | null
          temp8_rice_morning_t2: number | null
          temp8_rice_morning_t3: number | null
          temp8_rice_afternoon_t1: number | null
          temp8_rice_afternoon_t2: number | null
          temp8_rice_afternoon_t3: number | null
          temp9_chamber: number | null
          temp9_rice: number | null
          temp9_rice_morning_t1: number | null
          temp9_rice_morning_t2: number | null
          temp9_rice_morning_t3: number | null
          temp9_rice_afternoon_t1: number | null
          temp9_rice_afternoon_t2: number | null
          temp9_rice_afternoon_t3: number | null
          temp10_chamber: number | null
          temp10_rice: number | null
          temp10_rice_morning_t1: number | null
          temp10_rice_morning_t2: number | null
          temp10_rice_morning_t3: number | null
          temp10_rice_afternoon_t1: number | null
          temp10_rice_afternoon_t2: number | null
          temp10_rice_afternoon_t3: number | null
          temp11_chamber: number | null
          temp11_rice: number | null
          temp11_rice_morning_t1: number | null
          temp11_rice_morning_t2: number | null
          temp11_rice_morning_t3: number | null
          temp11_rice_afternoon_t1: number | null
          temp11_rice_afternoon_t2: number | null
          temp11_rice_afternoon_t3: number | null
          temp12_chamber: number | null
          temp12_rice: number | null
          temp12_rice_morning_t1: number | null
          temp12_rice_morning_t2: number | null
          temp12_rice_morning_t3: number | null
          temp12_rice_afternoon_t1: number | null
          temp12_rice_afternoon_t2: number | null
          temp12_rice_afternoon_t3: number | null
          temp13_chamber: number | null
          temp13_rice: number | null
          temp13_rice_morning_t1: number | null
          temp13_rice_morning_t2: number | null
          temp13_rice_morning_t3: number | null
          temp13_rice_afternoon_t1: number | null
          temp13_rice_afternoon_t2: number | null
          temp13_rice_afternoon_t3: number | null
          temp14_chamber: number | null
          temp14_rice: number | null
          temp14_rice_morning_t1: number | null
          temp14_rice_morning_t2: number | null
          temp14_rice_morning_t3: number | null
          temp14_rice_afternoon_t1: number | null
          temp14_rice_afternoon_t2: number | null
          temp14_rice_afternoon_t3: number | null
          wet_weight: number | null
          dry_weight: number | null
          extracted_conidium_weight: number | null
          date_7_day: string | null
          date_14_day: string | null
          annotations_7_day: Json | null
          annotations_14_day: Json | null
          discard_contaminations: Json
          created_by: string | null
          created_at: string
          updated_by: string | null
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
          temp1_chamber?: number | null
          temp1_rice?: number | null
          temp1_rice_morning_t1?: number | null
          temp1_rice_morning_t2?: number | null
          temp1_rice_morning_t3?: number | null
          temp1_rice_afternoon_t1?: number | null
          temp1_rice_afternoon_t2?: number | null
          temp1_rice_afternoon_t3?: number | null
          temp2_chamber?: number | null
          temp2_rice?: number | null
          temp2_rice_morning_t1?: number | null
          temp2_rice_morning_t2?: number | null
          temp2_rice_morning_t3?: number | null
          temp2_rice_afternoon_t1?: number | null
          temp2_rice_afternoon_t2?: number | null
          temp2_rice_afternoon_t3?: number | null
          temp3_chamber?: number | null
          temp3_rice?: number | null
          temp3_rice_morning_t1?: number | null
          temp3_rice_morning_t2?: number | null
          temp3_rice_morning_t3?: number | null
          temp3_rice_afternoon_t1?: number | null
          temp3_rice_afternoon_t2?: number | null
          temp3_rice_afternoon_t3?: number | null
          temp4_chamber?: number | null
          temp4_rice?: number | null
          temp4_rice_morning_t1?: number | null
          temp4_rice_morning_t2?: number | null
          temp4_rice_morning_t3?: number | null
          temp4_rice_afternoon_t1?: number | null
          temp4_rice_afternoon_t2?: number | null
          temp4_rice_afternoon_t3?: number | null
          temp5_chamber?: number | null
          temp5_rice?: number | null
          temp5_rice_morning_t1?: number | null
          temp5_rice_morning_t2?: number | null
          temp5_rice_morning_t3?: number | null
          temp5_rice_afternoon_t1?: number | null
          temp5_rice_afternoon_t2?: number | null
          temp5_rice_afternoon_t3?: number | null
          temp6_chamber?: number | null
          temp6_rice?: number | null
          temp6_rice_morning_t1?: number | null
          temp6_rice_morning_t2?: number | null
          temp6_rice_morning_t3?: number | null
          temp6_rice_afternoon_t1?: number | null
          temp6_rice_afternoon_t2?: number | null
          temp6_rice_afternoon_t3?: number | null
          temp7_chamber?: number | null
          temp7_rice?: number | null
          temp7_rice_morning_t1?: number | null
          temp7_rice_morning_t2?: number | null
          temp7_rice_morning_t3?: number | null
          temp7_rice_afternoon_t1?: number | null
          temp7_rice_afternoon_t2?: number | null
          temp7_rice_afternoon_t3?: number | null
          temp8_chamber?: number | null
          temp8_rice?: number | null
          temp8_rice_morning_t1?: number | null
          temp8_rice_morning_t2?: number | null
          temp8_rice_morning_t3?: number | null
          temp8_rice_afternoon_t1?: number | null
          temp8_rice_afternoon_t2?: number | null
          temp8_rice_afternoon_t3?: number | null
          temp9_chamber?: number | null
          temp9_rice?: number | null
          temp9_rice_morning_t1?: number | null
          temp9_rice_morning_t2?: number | null
          temp9_rice_morning_t3?: number | null
          temp9_rice_afternoon_t1?: number | null
          temp9_rice_afternoon_t2?: number | null
          temp9_rice_afternoon_t3?: number | null
          temp10_chamber?: number | null
          temp10_rice?: number | null
          temp10_rice_morning_t1?: number | null
          temp10_rice_morning_t2?: number | null
          temp10_rice_morning_t3?: number | null
          temp10_rice_afternoon_t1?: number | null
          temp10_rice_afternoon_t2?: number | null
          temp10_rice_afternoon_t3?: number | null
          temp11_chamber?: number | null
          temp11_rice?: number | null
          temp11_rice_morning_t1?: number | null
          temp11_rice_morning_t2?: number | null
          temp11_rice_morning_t3?: number | null
          temp11_rice_afternoon_t1?: number | null
          temp11_rice_afternoon_t2?: number | null
          temp11_rice_afternoon_t3?: number | null
          temp12_chamber?: number | null
          temp12_rice?: number | null
          temp12_rice_morning_t1?: number | null
          temp12_rice_morning_t2?: number | null
          temp12_rice_morning_t3?: number | null
          temp12_rice_afternoon_t1?: number | null
          temp12_rice_afternoon_t2?: number | null
          temp12_rice_afternoon_t3?: number | null
          temp13_chamber?: number | null
          temp13_rice?: number | null
          temp13_rice_morning_t1?: number | null
          temp13_rice_morning_t2?: number | null
          temp13_rice_morning_t3?: number | null
          temp13_rice_afternoon_t1?: number | null
          temp13_rice_afternoon_t2?: number | null
          temp13_rice_afternoon_t3?: number | null
          temp14_chamber?: number | null
          temp14_rice?: number | null
          temp14_rice_morning_t1?: number | null
          temp14_rice_morning_t2?: number | null
          temp14_rice_morning_t3?: number | null
          temp14_rice_afternoon_t1?: number | null
          temp14_rice_afternoon_t2?: number | null
          temp14_rice_afternoon_t3?: number | null
          wet_weight?: number | null
          dry_weight?: number | null
          extracted_conidium_weight?: number | null
          date_7_day?: string | null
          date_14_day?: string | null
          annotations_7_day?: Json | null
          annotations_14_day?: Json | null
          discard_contaminations?: Json
          created_by?: string | null
          created_at?: string
          updated_by?: string | null
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
          temp1_chamber?: number | null
          temp1_rice?: number | null
          temp1_rice_morning_t1?: number | null
          temp1_rice_morning_t2?: number | null
          temp1_rice_morning_t3?: number | null
          temp1_rice_afternoon_t1?: number | null
          temp1_rice_afternoon_t2?: number | null
          temp1_rice_afternoon_t3?: number | null
          temp2_chamber?: number | null
          temp2_rice?: number | null
          temp2_rice_morning_t1?: number | null
          temp2_rice_morning_t2?: number | null
          temp2_rice_morning_t3?: number | null
          temp2_rice_afternoon_t1?: number | null
          temp2_rice_afternoon_t2?: number | null
          temp2_rice_afternoon_t3?: number | null
          temp3_chamber?: number | null
          temp3_rice?: number | null
          temp3_rice_morning_t1?: number | null
          temp3_rice_morning_t2?: number | null
          temp3_rice_morning_t3?: number | null
          temp3_rice_afternoon_t1?: number | null
          temp3_rice_afternoon_t2?: number | null
          temp3_rice_afternoon_t3?: number | null
          temp4_chamber?: number | null
          temp4_rice?: number | null
          temp4_rice_morning_t1?: number | null
          temp4_rice_morning_t2?: number | null
          temp4_rice_morning_t3?: number | null
          temp4_rice_afternoon_t1?: number | null
          temp4_rice_afternoon_t2?: number | null
          temp4_rice_afternoon_t3?: number | null
          temp5_chamber?: number | null
          temp5_rice?: number | null
          temp5_rice_morning_t1?: number | null
          temp5_rice_morning_t2?: number | null
          temp5_rice_morning_t3?: number | null
          temp5_rice_afternoon_t1?: number | null
          temp5_rice_afternoon_t2?: number | null
          temp5_rice_afternoon_t3?: number | null
          temp6_chamber?: number | null
          temp6_rice?: number | null
          temp6_rice_morning_t1?: number | null
          temp6_rice_morning_t2?: number | null
          temp6_rice_morning_t3?: number | null
          temp6_rice_afternoon_t1?: number | null
          temp6_rice_afternoon_t2?: number | null
          temp6_rice_afternoon_t3?: number | null
          temp7_chamber?: number | null
          temp7_rice?: number | null
          temp7_rice_morning_t1?: number | null
          temp7_rice_morning_t2?: number | null
          temp7_rice_morning_t3?: number | null
          temp7_rice_afternoon_t1?: number | null
          temp7_rice_afternoon_t2?: number | null
          temp7_rice_afternoon_t3?: number | null
          temp8_chamber?: number | null
          temp8_rice?: number | null
          temp8_rice_morning_t1?: number | null
          temp8_rice_morning_t2?: number | null
          temp8_rice_morning_t3?: number | null
          temp8_rice_afternoon_t1?: number | null
          temp8_rice_afternoon_t2?: number | null
          temp8_rice_afternoon_t3?: number | null
          temp9_chamber?: number | null
          temp9_rice?: number | null
          temp9_rice_morning_t1?: number | null
          temp9_rice_morning_t2?: number | null
          temp9_rice_morning_t3?: number | null
          temp9_rice_afternoon_t1?: number | null
          temp9_rice_afternoon_t2?: number | null
          temp9_rice_afternoon_t3?: number | null
          temp10_chamber?: number | null
          temp10_rice?: number | null
          temp10_rice_morning_t1?: number | null
          temp10_rice_morning_t2?: number | null
          temp10_rice_morning_t3?: number | null
          temp10_rice_afternoon_t1?: number | null
          temp10_rice_afternoon_t2?: number | null
          temp10_rice_afternoon_t3?: number | null
          temp11_chamber?: number | null
          temp11_rice?: number | null
          temp11_rice_morning_t1?: number | null
          temp11_rice_morning_t2?: number | null
          temp11_rice_morning_t3?: number | null
          temp11_rice_afternoon_t1?: number | null
          temp11_rice_afternoon_t2?: number | null
          temp11_rice_afternoon_t3?: number | null
          temp12_chamber?: number | null
          temp12_rice?: number | null
          temp12_rice_morning_t1?: number | null
          temp12_rice_morning_t2?: number | null
          temp12_rice_morning_t3?: number | null
          temp12_rice_afternoon_t1?: number | null
          temp12_rice_afternoon_t2?: number | null
          temp12_rice_afternoon_t3?: number | null
          temp13_chamber?: number | null
          temp13_rice?: number | null
          temp13_rice_morning_t1?: number | null
          temp13_rice_morning_t2?: number | null
          temp13_rice_morning_t3?: number | null
          temp13_rice_afternoon_t1?: number | null
          temp13_rice_afternoon_t2?: number | null
          temp13_rice_afternoon_t3?: number | null
          temp14_chamber?: number | null
          temp14_rice?: number | null
          temp14_rice_morning_t1?: number | null
          temp14_rice_morning_t2?: number | null
          temp14_rice_morning_t3?: number | null
          temp14_rice_afternoon_t1?: number | null
          temp14_rice_afternoon_t2?: number | null
          temp14_rice_afternoon_t3?: number | null
          wet_weight?: number | null
          dry_weight?: number | null
          extracted_conidium_weight?: number | null
          date_7_day?: string | null
          date_14_day?: string | null
          annotations_7_day?: Json | null
          annotations_14_day?: Json | null
          discard_contaminations?: Json
          created_by?: string | null
          created_at?: string
          updated_by?: string | null
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
            foreignKeyName: "tests_updated_by_fkey"
            columns: ["updated_by"]
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
      fungi: {
        Row: {
          id: string
          scientific_name: string
          optimal_temperature: number
          min_temperature: number
          max_temperature: number
          acronyms: string[]
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          scientific_name: string
          optimal_temperature: number
          min_temperature: number
          max_temperature: number
          acronyms?: string[]
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          scientific_name?: string
          optimal_temperature?: number
          min_temperature?: number
          max_temperature?: number
          acronyms?: string[]
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fungi_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_invitations: {
        Row: {
          id: string
          email: string
          full_name: string | null
          role: string
          status: string
          token_hash: string
          invited_by: string | null
          accepted_user_id: string | null
          expires_at: string
          accepted_at: string | null
          revoked_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          full_name?: string | null
          role?: string
          status?: string
          token_hash: string
          invited_by?: string | null
          accepted_user_id?: string | null
          expires_at: string
          accepted_at?: string | null
          revoked_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          role?: string
          status?: string
          token_hash?: string
          invited_by?: string | null
          accepted_user_id?: string | null
          expires_at?: string
          accepted_at?: string | null
          revoked_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_invitations_accepted_user_id_fkey"
            columns: ["accepted_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "users"
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
