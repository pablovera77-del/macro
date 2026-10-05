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
      alert_type_recipients: {
        Row: {
          alert_type: string
          id: string
          role: Database["public"]["Enums"]["app_role"] | null
          user_id: string | null
        }
        Insert: {
          alert_type: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"] | null
          user_id?: string | null
        }
        Update: {
          alert_type?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"] | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alert_type_recipients_alert_type_fkey"
            columns: ["alert_type"]
            isOneToOne: false
            referencedRelation: "alert_types"
            referencedColumns: ["codigo"]
          },
          {
            foreignKeyName: "alert_type_recipients_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_types: {
        Row: {
          activo: boolean
          canal_app: boolean
          canal_email: boolean
          canal_whatsapp: boolean
          codigo: string
          created_at: string
          descripcion: string | null
          mensaje: string
          nombre: string
          parametros: Json
          urgencia: string
        }
        Insert: {
          activo?: boolean
          canal_app?: boolean
          canal_email?: boolean
          canal_whatsapp?: boolean
          codigo: string
          created_at?: string
          descripcion?: string | null
          mensaje: string
          nombre: string
          parametros?: Json
          urgencia: string
        }
        Update: {
          activo?: boolean
          canal_app?: boolean
          canal_email?: boolean
          canal_whatsapp?: boolean
          codigo?: string
          created_at?: string
          descripcion?: string | null
          mensaje?: string
          nombre?: string
          parametros?: Json
          urgencia?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          clave: string
          descripcion: string | null
          updated_at: string
          updated_by: string | null
          valor: number
        }
        Insert: {
          clave: string
          descripcion?: string | null
          updated_at?: string
          updated_by?: string | null
          valor: number
        }
        Update: {
          clave?: string
          descripcion?: string | null
          updated_at?: string
          updated_by?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      arrival_tokens: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          patient_id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          patient_id: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          patient_id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "arrival_tokens_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arrival_tokens_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arrival_tokens_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_control_frecuencia_diaria"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "arrival_tokens_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_control_frecuencia_semanal"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "arrival_tokens_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_prevalidacion_controles"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "arrival_tokens_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_prevalidacion_facturacion"
            referencedColumns: ["patient_id"]
          },
        ]
      }
      audit_log: {
        Row: {
          accion: string
          created_at: string
          entidad: string
          entidad_id: string
          id: number
          payload_antes: Json | null
          payload_despues: Json | null
          user_id: string | null
        }
        Insert: {
          accion: string
          created_at?: string
          entidad: string
          entidad_id: string
          id?: never
          payload_antes?: Json | null
          payload_despues?: Json | null
          user_id?: string | null
        }
        Update: {
          accion?: string
          created_at?: string
          entidad?: string
          entidad_id?: string
          id?: never
          payload_antes?: Json | null
          payload_despues?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      authorization_extensions: {
        Row: {
          authorization_id: number
          created_at: string
          estado: string
          fecha_hasta_anterior: string | null
          gestionada_por: string | null
          id: string
          nota: string | null
          nueva_fecha_hasta: string | null
          patient_id: string
          pedida_at: string
          respondida_at: string | null
        }
        Insert: {
          authorization_id: number
          created_at?: string
          estado?: string
          fecha_hasta_anterior?: string | null
          gestionada_por?: string | null
          id?: string
          nota?: string | null
          nueva_fecha_hasta?: string | null
          patient_id: string
          pedida_at?: string
          respondida_at?: string | null
        }
        Update: {
          authorization_id?: number
          created_at?: string
          estado?: string
          fecha_hasta_anterior?: string | null
          gestionada_por?: string | null
          id?: string
          nota?: string | null
          nueva_fecha_hasta?: string | null
          patient_id?: string
          pedida_at?: string
          respondida_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "authorization_extensions_authorization_id_fkey"
            columns: ["authorization_id"]
            isOneToOne: false
            referencedRelation: "treatment_authorizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "authorization_extensions_authorization_id_fkey"
            columns: ["authorization_id"]
            isOneToOne: false
            referencedRelation: "v_control_frecuencia_diaria"
            referencedColumns: ["treatment_authorization_id"]
          },
          {
            foreignKeyName: "authorization_extensions_authorization_id_fkey"
            columns: ["authorization_id"]
            isOneToOne: false
            referencedRelation: "v_control_frecuencia_semanal"
            referencedColumns: ["treatment_authorization_id"]
          },
          {
            foreignKeyName: "authorization_extensions_authorization_id_fkey"
            columns: ["authorization_id"]
            isOneToOne: false
            referencedRelation: "v_prevalidacion_facturacion"
            referencedColumns: ["treatment_authorization_id"]
          },
          {
            foreignKeyName: "authorization_extensions_authorization_id_fkey"
            columns: ["authorization_id"]
            isOneToOne: false
            referencedRelation: "v_treatment_authorization_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "authorization_extensions_gestionada_por_fkey"
            columns: ["gestionada_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "authorization_extensions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "authorization_extensions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_control_frecuencia_diaria"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "authorization_extensions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_control_frecuencia_semanal"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "authorization_extensions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_prevalidacion_controles"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "authorization_extensions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_prevalidacion_facturacion"
            referencedColumns: ["patient_id"]
          },
        ]
      }
      billing_debits: {
        Row: {
          billing_period_id: string
          created_at: string
          estado: Database["public"]["Enums"]["debit_status"]
          fecha_resubmision: string | null
          gestionado_por: string | null
          id: number
          monto: number
          motivo: string
          patient_id: string | null
          reclamable: boolean
          resubmision_notas: string | null
        }
        Insert: {
          billing_period_id: string
          created_at?: string
          estado?: Database["public"]["Enums"]["debit_status"]
          fecha_resubmision?: string | null
          gestionado_por?: string | null
          id?: never
          monto: number
          motivo: string
          patient_id?: string | null
          reclamable?: boolean
          resubmision_notas?: string | null
        }
        Update: {
          billing_period_id?: string
          created_at?: string
          estado?: Database["public"]["Enums"]["debit_status"]
          fecha_resubmision?: string | null
          gestionado_por?: string | null
          id?: never
          monto?: number
          motivo?: string
          patient_id?: string | null
          reclamable?: boolean
          resubmision_notas?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_debits_billing_period_id_fkey"
            columns: ["billing_period_id"]
            isOneToOne: false
            referencedRelation: "billing_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_debits_billing_period_id_fkey"
            columns: ["billing_period_id"]
            isOneToOne: false
            referencedRelation: "v_cierre_sugerido"
            referencedColumns: ["billing_period_id"]
          },
          {
            foreignKeyName: "billing_debits_billing_period_id_fkey"
            columns: ["billing_period_id"]
            isOneToOne: false
            referencedRelation: "v_prevalidacion_controles"
            referencedColumns: ["billing_period_id"]
          },
          {
            foreignKeyName: "billing_debits_billing_period_id_fkey"
            columns: ["billing_period_id"]
            isOneToOne: false
            referencedRelation: "v_prevalidacion_facturacion"
            referencedColumns: ["billing_period_id"]
          },
          {
            foreignKeyName: "billing_debits_billing_period_id_fkey"
            columns: ["billing_period_id"]
            isOneToOne: false
            referencedRelation: "v_prevalidacion_resumen"
            referencedColumns: ["billing_period_id"]
          },
          {
            foreignKeyName: "billing_debits_gestionado_por_fkey"
            columns: ["gestionado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_debits_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_debits_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_control_frecuencia_diaria"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "billing_debits_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_control_frecuencia_semanal"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "billing_debits_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_prevalidacion_controles"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "billing_debits_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_prevalidacion_facturacion"
            referencedColumns: ["patient_id"]
          },
        ]
      }
      billing_period_exclusions: {
        Row: {
          billing_period_id: string
          created_at: string
          excluido_por: string | null
          id: number
          motivo: string | null
          patient_id: string
        }
        Insert: {
          billing_period_id: string
          created_at?: string
          excluido_por?: string | null
          id?: never
          motivo?: string | null
          patient_id: string
        }
        Update: {
          billing_period_id?: string
          created_at?: string
          excluido_por?: string | null
          id?: never
          motivo?: string | null
          patient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_period_exclusions_billing_period_id_fkey"
            columns: ["billing_period_id"]
            isOneToOne: false
            referencedRelation: "billing_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_period_exclusions_billing_period_id_fkey"
            columns: ["billing_period_id"]
            isOneToOne: false
            referencedRelation: "v_cierre_sugerido"
            referencedColumns: ["billing_period_id"]
          },
          {
            foreignKeyName: "billing_period_exclusions_billing_period_id_fkey"
            columns: ["billing_period_id"]
            isOneToOne: false
            referencedRelation: "v_prevalidacion_controles"
            referencedColumns: ["billing_period_id"]
          },
          {
            foreignKeyName: "billing_period_exclusions_billing_period_id_fkey"
            columns: ["billing_period_id"]
            isOneToOne: false
            referencedRelation: "v_prevalidacion_facturacion"
            referencedColumns: ["billing_period_id"]
          },
          {
            foreignKeyName: "billing_period_exclusions_billing_period_id_fkey"
            columns: ["billing_period_id"]
            isOneToOne: false
            referencedRelation: "v_prevalidacion_resumen"
            referencedColumns: ["billing_period_id"]
          },
          {
            foreignKeyName: "billing_period_exclusions_excluido_por_fkey"
            columns: ["excluido_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_period_exclusions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_period_exclusions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_control_frecuencia_diaria"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "billing_period_exclusions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_control_frecuencia_semanal"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "billing_period_exclusions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_prevalidacion_controles"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "billing_period_exclusions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_prevalidacion_facturacion"
            referencedColumns: ["patient_id"]
          },
        ]
      }
      billing_periods: {
        Row: {
          cerrado_por: string | null
          cobro_actualizado_por: string | null
          created_at: string
          estado: Database["public"]["Enums"]["billing_period_status"]
          fecha_cierre: string | null
          fecha_cobro: string | null
          id: string
          monto_cobrado: number | null
          obra_social_id: string
          periodo: string
          total_facturado: number | null
        }
        Insert: {
          cerrado_por?: string | null
          cobro_actualizado_por?: string | null
          created_at?: string
          estado?: Database["public"]["Enums"]["billing_period_status"]
          fecha_cierre?: string | null
          fecha_cobro?: string | null
          id?: string
          monto_cobrado?: number | null
          obra_social_id: string
          periodo: string
          total_facturado?: number | null
        }
        Update: {
          cerrado_por?: string | null
          cobro_actualizado_por?: string | null
          created_at?: string
          estado?: Database["public"]["Enums"]["billing_period_status"]
          fecha_cierre?: string | null
          fecha_cobro?: string | null
          id?: string
          monto_cobrado?: number | null
          obra_social_id?: string
          periodo?: string
          total_facturado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_periods_cerrado_por_fkey"
            columns: ["cerrado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_periods_cobro_actualizado_por_fkey"
            columns: ["cobro_actualizado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_periods_obra_social_id_fkey"
            columns: ["obra_social_id"]
            isOneToOne: false
            referencedRelation: "obras_sociales"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_items: {
        Row: {
          activo: boolean
          catalogo: string
          codigo: string
          created_at: string
          id: string
          nombre: string
          orden: number
        }
        Insert: {
          activo?: boolean
          catalogo: string
          codigo: string
          created_at?: string
          id?: string
          nombre: string
          orden?: number
        }
        Update: {
          activo?: boolean
          catalogo?: string
          codigo?: string
          created_at?: string
          id?: string
          nombre?: string
          orden?: number
        }
        Relationships: []
      }
      discharge_alerts: {
        Row: {
          estado: Database["public"]["Enums"]["discharge_status"]
          fecha: string
          generado_por: string
          id: string
          motivo: Database["public"]["Enums"]["discharge_reason"]
          patient_id: string
        }
        Insert: {
          estado?: Database["public"]["Enums"]["discharge_status"]
          fecha?: string
          generado_por: string
          id?: string
          motivo: Database["public"]["Enums"]["discharge_reason"]
          patient_id: string
        }
        Update: {
          estado?: Database["public"]["Enums"]["discharge_status"]
          fecha?: string
          generado_por?: string
          id?: string
          motivo?: Database["public"]["Enums"]["discharge_reason"]
          patient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discharge_alerts_generado_por_fkey"
            columns: ["generado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discharge_alerts_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discharge_alerts_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_control_frecuencia_diaria"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "discharge_alerts_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_control_frecuencia_semanal"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "discharge_alerts_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_prevalidacion_controles"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "discharge_alerts_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_prevalidacion_facturacion"
            referencedColumns: ["patient_id"]
          },
        ]
      }
      discipline_form_templates: {
        Row: {
          activo: boolean
          campos: Json
          created_at: string
          especialidad: Database["public"]["Enums"]["specialty"]
          id: string
          titulo: string
        }
        Insert: {
          activo?: boolean
          campos?: Json
          created_at?: string
          especialidad: Database["public"]["Enums"]["specialty"]
          id?: string
          titulo: string
        }
        Update: {
          activo?: boolean
          campos?: Json
          created_at?: string
          especialidad?: Database["public"]["Enums"]["specialty"]
          id?: string
          titulo?: string
        }
        Relationships: []
      }
      equipment_asset_movements: {
        Row: {
          asset_id: string
          confirmado_por: string | null
          domicilio_destino: string | null
          domicilio_origen: string | null
          fecha: string
          id: number
          lat: number | null
          lng: number | null
          notas: string | null
          patient_id: string | null
          tipo: Database["public"]["Enums"]["asset_movement_type"]
        }
        Insert: {
          asset_id: string
          confirmado_por?: string | null
          domicilio_destino?: string | null
          domicilio_origen?: string | null
          fecha?: string
          id?: never
          lat?: number | null
          lng?: number | null
          notas?: string | null
          patient_id?: string | null
          tipo: Database["public"]["Enums"]["asset_movement_type"]
        }
        Update: {
          asset_id?: string
          confirmado_por?: string | null
          domicilio_destino?: string | null
          domicilio_origen?: string | null
          fecha?: string
          id?: never
          lat?: number | null
          lng?: number | null
          notas?: string | null
          patient_id?: string | null
          tipo?: Database["public"]["Enums"]["asset_movement_type"]
        }
        Relationships: [
          {
            foreignKeyName: "equipment_asset_movements_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "equipment_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_asset_movements_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "v_equipos_en_domicilio"
            referencedColumns: ["asset_id"]
          },
          {
            foreignKeyName: "equipment_asset_movements_confirmado_por_fkey"
            columns: ["confirmado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_asset_movements_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_asset_movements_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_control_frecuencia_diaria"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "equipment_asset_movements_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_control_frecuencia_semanal"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "equipment_asset_movements_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_prevalidacion_controles"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "equipment_asset_movements_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_prevalidacion_facturacion"
            referencedColumns: ["patient_id"]
          },
        ]
      }
      equipment_asset_photos: {
        Row: {
          asset_id: string
          condicion: string | null
          created_at: string
          id: number
          lat: number | null
          lng: number | null
          momento: string
          tomada_por: string | null
          url: string
        }
        Insert: {
          asset_id: string
          condicion?: string | null
          created_at?: string
          id?: never
          lat?: number | null
          lng?: number | null
          momento: string
          tomada_por?: string | null
          url: string
        }
        Update: {
          asset_id?: string
          condicion?: string | null
          created_at?: string
          id?: never
          lat?: number | null
          lng?: number | null
          momento?: string
          tomada_por?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_asset_photos_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "equipment_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_asset_photos_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "v_equipos_en_domicilio"
            referencedColumns: ["asset_id"]
          },
          {
            foreignKeyName: "equipment_asset_photos_tomada_por_fkey"
            columns: ["tomada_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_assets: {
        Row: {
          created_at: string
          estado: Database["public"]["Enums"]["asset_status"]
          id: string
          notas_condicion: string | null
          numero_serie: string
          product_id: string
          propiedad: Database["public"]["Enums"]["ownership_type"]
        }
        Insert: {
          created_at?: string
          estado?: Database["public"]["Enums"]["asset_status"]
          id?: string
          notas_condicion?: string | null
          numero_serie: string
          product_id: string
          propiedad?: Database["public"]["Enums"]["ownership_type"]
        }
        Update: {
          created_at?: string
          estado?: Database["public"]["Enums"]["asset_status"]
          id?: string
          notas_condicion?: string | null
          numero_serie?: string
          product_id?: string
          propiedad?: Database["public"]["Enums"]["ownership_type"]
        }
        Relationships: [
          {
            foreignKeyName: "equipment_assets_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_assets_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_disponibilidad_deposito"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "equipment_assets_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_products_status"
            referencedColumns: ["id"]
          },
        ]
      }
      evolution_notes: {
        Row: {
          autor_id: string
          created_at: string
          evolution_id: string
          id: string
          texto: string
        }
        Insert: {
          autor_id?: string
          created_at?: string
          evolution_id: string
          id?: string
          texto: string
        }
        Update: {
          autor_id?: string
          created_at?: string
          evolution_id?: string
          id?: string
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "evolution_notes_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evolution_notes_evolution_id_fkey"
            columns: ["evolution_id"]
            isOneToOne: false
            referencedRelation: "evolutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evolution_notes_evolution_id_fkey"
            columns: ["evolution_id"]
            isOneToOne: false
            referencedRelation: "v_hc_sin_firmas"
            referencedColumns: ["evolution_id"]
          },
          {
            foreignKeyName: "evolution_notes_evolution_id_fkey"
            columns: ["evolution_id"]
            isOneToOne: false
            referencedRelation: "v_visit_evolution_discrepancies"
            referencedColumns: ["evolution_id"]
          },
        ]
      }
      evolutions: {
        Row: {
          alerta_cambio: boolean
          alerta_motivo: string | null
          conformidad_familiar: boolean | null
          conformidad_familiar_at: string | null
          conformidad_firma: string | null
          conformidad_lat: number | null
          conformidad_lng: number | null
          conformidad_nombre: string | null
          created_at: string
          especialidad: Database["public"]["Enums"]["specialty"]
          firma_lat: number | null
          firma_lng: number | null
          firma_profesional_at: string | null
          firma_profesional_img: string | null
          firma_profesional_matricula: string | null
          firma_profesional_nombre: string | null
          id: string
          medicacion: Json | null
          patient_id: string
          profesional_id: string
          respuestas: Json
          template_id: string | null
          upp_escala_nova5: Json | null
          visit_id: string | null
        }
        Insert: {
          alerta_cambio?: boolean
          alerta_motivo?: string | null
          conformidad_familiar?: boolean | null
          conformidad_familiar_at?: string | null
          conformidad_firma?: string | null
          conformidad_lat?: number | null
          conformidad_lng?: number | null
          conformidad_nombre?: string | null
          created_at?: string
          especialidad: Database["public"]["Enums"]["specialty"]
          firma_lat?: number | null
          firma_lng?: number | null
          firma_profesional_at?: string | null
          firma_profesional_img?: string | null
          firma_profesional_matricula?: string | null
          firma_profesional_nombre?: string | null
          id?: string
          medicacion?: Json | null
          patient_id: string
          profesional_id: string
          respuestas?: Json
          template_id?: string | null
          upp_escala_nova5?: Json | null
          visit_id?: string | null
        }
        Update: {
          alerta_cambio?: boolean
          alerta_motivo?: string | null
          conformidad_familiar?: boolean | null
          conformidad_familiar_at?: string | null
          conformidad_firma?: string | null
          conformidad_lat?: number | null
          conformidad_lng?: number | null
          conformidad_nombre?: string | null
          created_at?: string
          especialidad?: Database["public"]["Enums"]["specialty"]
          firma_lat?: number | null
          firma_lng?: number | null
          firma_profesional_at?: string | null
          firma_profesional_img?: string | null
          firma_profesional_matricula?: string | null
          firma_profesional_nombre?: string | null
          id?: string
          medicacion?: Json | null
          patient_id?: string
          profesional_id?: string
          respuestas?: Json
          template_id?: string | null
          upp_escala_nova5?: Json | null
          visit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evolutions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evolutions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_control_frecuencia_diaria"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "evolutions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_control_frecuencia_semanal"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "evolutions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_prevalidacion_controles"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "evolutions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_prevalidacion_facturacion"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "evolutions_profesional_id_fkey"
            columns: ["profesional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evolutions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "discipline_form_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evolutions_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "v_visit_evolution_discrepancies"
            referencedColumns: ["visit_id"]
          },
          {
            foreignKeyName: "evolutions_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      family_access: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string
          failed_attempts: number
          id: string
          last_access_at: string | null
          locked_until: string | null
          patient_id: string
          pin_hash: string
          revoked_at: string | null
          revoked_by: string | null
          token: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string
          failed_attempts?: number
          id?: string
          last_access_at?: string | null
          locked_until?: string | null
          patient_id: string
          pin_hash: string
          revoked_at?: string | null
          revoked_by?: string | null
          token: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string
          failed_attempts?: number
          id?: string
          last_access_at?: string | null
          locked_until?: string | null
          patient_id?: string
          pin_hash?: string
          revoked_at?: string | null
          revoked_by?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_access_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_access_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_access_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_control_frecuencia_diaria"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "family_access_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_control_frecuencia_semanal"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "family_access_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_prevalidacion_controles"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "family_access_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_prevalidacion_facturacion"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "family_access_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      family_visit_confirmations: {
        Row: {
          access_id: string
          confirmed_at: string
          id: string
          nombre: string
          visit_id: string
        }
        Insert: {
          access_id: string
          confirmed_at?: string
          id?: string
          nombre: string
          visit_id: string
        }
        Update: {
          access_id?: string
          confirmed_at?: string
          id?: string
          nombre?: string
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_visit_confirmations_access_id_fkey"
            columns: ["access_id"]
            isOneToOne: false
            referencedRelation: "family_access"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_visit_confirmations_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: true
            referencedRelation: "v_visit_evolution_discrepancies"
            referencedColumns: ["visit_id"]
          },
          {
            foreignKeyName: "family_visit_confirmations_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: true
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      info_checklist_items: {
        Row: {
          activo: boolean
          id: string
          orden: number
          texto: string
        }
        Insert: {
          activo?: boolean
          id?: string
          orden: number
          texto: string
        }
        Update: {
          activo?: boolean
          id?: string
          orden?: number
          texto?: string
        }
        Relationships: []
      }
      legal_documents: {
        Row: {
          activo: boolean
          codigo: string
          created_at: string
          id: string
          orden: number
          requiere_firma_profesional: boolean
          resumen: string | null
          titulo: string
        }
        Insert: {
          activo?: boolean
          codigo: string
          created_at?: string
          id?: string
          orden?: number
          requiere_firma_profesional?: boolean
          resumen?: string | null
          titulo: string
        }
        Update: {
          activo?: boolean
          codigo?: string
          created_at?: string
          id?: string
          orden?: number
          requiere_firma_profesional?: boolean
          resumen?: string | null
          titulo?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          alert_type: string
          created_at: string
          entidad: string | null
          entidad_id: string | null
          href: string | null
          id: string
          mensaje: string
          read_at: string | null
          user_id: string
        }
        Insert: {
          alert_type: string
          created_at?: string
          entidad?: string | null
          entidad_id?: string | null
          href?: string | null
          id?: string
          mensaje: string
          read_at?: string | null
          user_id: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          entidad?: string | null
          entidad_id?: string | null
          href?: string | null
          id?: string
          mensaje?: string
          read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_alert_type_fkey"
            columns: ["alert_type"]
            isOneToOne: false
            referencedRelation: "alert_types"
            referencedColumns: ["codigo"]
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
      obra_social_value_history: {
        Row: {
          cargado_por: string | null
          created_at: string
          id: number
          obra_social_id: string
          valor: number
          vigente_desde: string
        }
        Insert: {
          cargado_por?: string | null
          created_at?: string
          id?: never
          obra_social_id: string
          valor: number
          vigente_desde?: string
        }
        Update: {
          cargado_por?: string | null
          created_at?: string
          id?: never
          obra_social_id?: string
          valor?: number
          vigente_desde?: string
        }
        Relationships: [
          {
            foreignKeyName: "obra_social_value_history_cargado_por_fkey"
            columns: ["cargado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_social_value_history_obra_social_id_fkey"
            columns: ["obra_social_id"]
            isOneToOne: false
            referencedRelation: "obras_sociales"
            referencedColumns: ["id"]
          },
        ]
      }
      obras_sociales: {
        Row: {
          activa: boolean
          auditoria_contacto_email: string | null
          auditoria_contacto_nombre: string | null
          auditoria_contacto_telefono: string | null
          coseguro_codigo: string | null
          created_at: string
          cuit: string | null
          dias_para_facturar: number
          id: string
          modalidad_facturacion: string | null
          nombre: string
          reglas_facturacion: string | null
          responsable_id: string | null
          valor_modulo: number | null
        }
        Insert: {
          activa?: boolean
          auditoria_contacto_email?: string | null
          auditoria_contacto_nombre?: string | null
          auditoria_contacto_telefono?: string | null
          coseguro_codigo?: string | null
          created_at?: string
          cuit?: string | null
          dias_para_facturar?: number
          id?: string
          modalidad_facturacion?: string | null
          nombre: string
          reglas_facturacion?: string | null
          responsable_id?: string | null
          valor_modulo?: number | null
        }
        Update: {
          activa?: boolean
          auditoria_contacto_email?: string | null
          auditoria_contacto_nombre?: string | null
          auditoria_contacto_telefono?: string | null
          coseguro_codigo?: string | null
          created_at?: string
          cuit?: string | null
          dias_para_facturar?: number
          id?: string
          modalidad_facturacion?: string | null
          nombre?: string
          reglas_facturacion?: string | null
          responsable_id?: string | null
          valor_modulo?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "obras_sociales_responsable_id_fkey"
            columns: ["responsable_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          cantidad: number
          cantidad_solicitada: number | null
          equipment_asset_id: string | null
          estado_item: string
          id: number
          motivo: string | null
          order_id: string
          product_id: string
          revisado_at: string | null
          revisado_por: string | null
        }
        Insert: {
          cantidad?: number
          cantidad_solicitada?: number | null
          equipment_asset_id?: string | null
          estado_item?: string
          id?: never
          motivo?: string | null
          order_id: string
          product_id: string
          revisado_at?: string | null
          revisado_por?: string | null
        }
        Update: {
          cantidad?: number
          cantidad_solicitada?: number | null
          equipment_asset_id?: string | null
          estado_item?: string
          id?: never
          motivo?: string | null
          order_id?: string
          product_id?: string
          revisado_at?: string | null
          revisado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_equipment_asset_id_fkey"
            columns: ["equipment_asset_id"]
            isOneToOne: false
            referencedRelation: "equipment_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_equipment_asset_id_fkey"
            columns: ["equipment_asset_id"]
            isOneToOne: false
            referencedRelation: "v_equipos_en_domicilio"
            referencedColumns: ["asset_id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_disponibilidad_deposito"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_products_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_revisado_por_fkey"
            columns: ["revisado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_notices: {
        Row: {
          creado_por: string | null
          created_at: string
          detalle: string | null
          href: string | null
          id: number
          leido_at: string | null
          leido_por: string | null
          order_id: string | null
          patient_id: string | null
          rol_destino: Database["public"]["Enums"]["app_role"] | null
          tipo: string
          titulo: string
          user_destino: string | null
        }
        Insert: {
          creado_por?: string | null
          created_at?: string
          detalle?: string | null
          href?: string | null
          id?: never
          leido_at?: string | null
          leido_por?: string | null
          order_id?: string | null
          patient_id?: string | null
          rol_destino?: Database["public"]["Enums"]["app_role"] | null
          tipo: string
          titulo: string
          user_destino?: string | null
        }
        Update: {
          creado_por?: string | null
          created_at?: string
          detalle?: string | null
          href?: string | null
          id?: never
          leido_at?: string | null
          leido_por?: string | null
          order_id?: string | null
          patient_id?: string | null
          rol_destino?: Database["public"]["Enums"]["app_role"] | null
          tipo?: string
          titulo?: string
          user_destino?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_notices_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_notices_leido_por_fkey"
            columns: ["leido_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_notices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_notices_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_notices_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_control_frecuencia_diaria"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "order_notices_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_control_frecuencia_semanal"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "order_notices_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_prevalidacion_controles"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "order_notices_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_prevalidacion_facturacion"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "order_notices_user_destino_fkey"
            columns: ["user_destino"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          autorizacion_automatica: boolean
          autorizado_por: string | null
          canal_entrega: Database["public"]["Enums"]["order_delivery_channel"]
          creado_por: string
          created_at: string
          direccion_entrega: string | null
          estado: Database["public"]["Enums"]["order_status"]
          fecha_autorizacion: string | null
          fecha_preparado: string | null
          id: string
          motivo_rechazo: string | null
          motivo_urgencia: string | null
          origen: string
          patient_id: string | null
          preparado_por: string | null
          prioridad: Database["public"]["Enums"]["order_priority"]
          profesional_id: string | null
          rechazado_por: string | null
        }
        Insert: {
          autorizacion_automatica?: boolean
          autorizado_por?: string | null
          canal_entrega?: Database["public"]["Enums"]["order_delivery_channel"]
          creado_por: string
          created_at?: string
          direccion_entrega?: string | null
          estado?: Database["public"]["Enums"]["order_status"]
          fecha_autorizacion?: string | null
          fecha_preparado?: string | null
          id?: string
          motivo_rechazo?: string | null
          motivo_urgencia?: string | null
          origen?: string
          patient_id?: string | null
          preparado_por?: string | null
          prioridad?: Database["public"]["Enums"]["order_priority"]
          profesional_id?: string | null
          rechazado_por?: string | null
        }
        Update: {
          autorizacion_automatica?: boolean
          autorizado_por?: string | null
          canal_entrega?: Database["public"]["Enums"]["order_delivery_channel"]
          creado_por?: string
          created_at?: string
          direccion_entrega?: string | null
          estado?: Database["public"]["Enums"]["order_status"]
          fecha_autorizacion?: string | null
          fecha_preparado?: string | null
          id?: string
          motivo_rechazo?: string | null
          motivo_urgencia?: string | null
          origen?: string
          patient_id?: string | null
          preparado_por?: string | null
          prioridad?: Database["public"]["Enums"]["order_priority"]
          profesional_id?: string | null
          rechazado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_autorizado_por_fkey"
            columns: ["autorizado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_control_frecuencia_diaria"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "orders_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_control_frecuencia_semanal"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "orders_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_prevalidacion_controles"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "orders_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_prevalidacion_facturacion"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "orders_preparado_por_fkey"
            columns: ["preparado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_profesional_id_fkey"
            columns: ["profesional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_rechazado_por_fkey"
            columns: ["rechazado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      os_required_documents: {
        Row: {
          activo: boolean
          id: string
          nombre: string
          obligatorio: boolean
          obra_social_id: string
          orden: number
        }
        Insert: {
          activo?: boolean
          id?: string
          nombre: string
          obligatorio?: boolean
          obra_social_id: string
          orden?: number
        }
        Update: {
          activo?: boolean
          id?: string
          nombre?: string
          obligatorio?: boolean
          obra_social_id?: string
          orden?: number
        }
        Relationships: [
          {
            foreignKeyName: "os_required_documents_obra_social_id_fkey"
            columns: ["obra_social_id"]
            isOneToOne: false
            referencedRelation: "obras_sociales"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_authorizations: {
        Row: {
          cantidad_autorizada: number
          cargado_por: string
          created_at: string
          id: number
          patient_id: string
          product_id: string
          vigente_desde: string
          vigente_hasta: string | null
        }
        Insert: {
          cantidad_autorizada: number
          cargado_por: string
          created_at?: string
          id?: never
          patient_id: string
          product_id: string
          vigente_desde?: string
          vigente_hasta?: string | null
        }
        Update: {
          cantidad_autorizada?: number
          cargado_por?: string
          created_at?: string
          id?: never
          patient_id?: string
          product_id?: string
          vigente_desde?: string
          vigente_hasta?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_authorizations_cargado_por_fkey"
            columns: ["cargado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_authorizations_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_authorizations_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_control_frecuencia_diaria"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "patient_authorizations_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_control_frecuencia_semanal"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "patient_authorizations_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_prevalidacion_controles"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "patient_authorizations_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_prevalidacion_facturacion"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "patient_authorizations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_authorizations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_disponibilidad_deposito"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "patient_authorizations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_products_status"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_care_team: {
        Row: {
          created_at: string
          especialidad: Database["public"]["Enums"]["specialty"]
          id: number
          patient_id: string
          profesional_id: string
        }
        Insert: {
          created_at?: string
          especialidad: Database["public"]["Enums"]["specialty"]
          id?: never
          patient_id: string
          profesional_id: string
        }
        Update: {
          created_at?: string
          especialidad?: Database["public"]["Enums"]["specialty"]
          id?: never
          patient_id?: string
          profesional_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_care_team_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_care_team_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_control_frecuencia_diaria"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "patient_care_team_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_control_frecuencia_semanal"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "patient_care_team_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_prevalidacion_controles"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "patient_care_team_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_prevalidacion_facturacion"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "patient_care_team_profesional_id_fkey"
            columns: ["profesional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_document_signatures: {
        Row: {
          firmado_at: string
          firmante_nombre: string
          geolocalizacion_lat: number | null
          geolocalizacion_lng: number | null
          id: string
          legal_document_id: string
          patient_id: string
          profesional_firmado_at: string | null
          profesional_id: string | null
        }
        Insert: {
          firmado_at?: string
          firmante_nombre: string
          geolocalizacion_lat?: number | null
          geolocalizacion_lng?: number | null
          id?: string
          legal_document_id: string
          patient_id: string
          profesional_firmado_at?: string | null
          profesional_id?: string | null
        }
        Update: {
          firmado_at?: string
          firmante_nombre?: string
          geolocalizacion_lat?: number | null
          geolocalizacion_lng?: number | null
          id?: string
          legal_document_id?: string
          patient_id?: string
          profesional_firmado_at?: string | null
          profesional_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_document_signatures_legal_document_id_fkey"
            columns: ["legal_document_id"]
            isOneToOne: false
            referencedRelation: "legal_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_document_signatures_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_document_signatures_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_control_frecuencia_diaria"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "patient_document_signatures_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_control_frecuencia_semanal"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "patient_document_signatures_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_prevalidacion_controles"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "patient_document_signatures_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_prevalidacion_facturacion"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "patient_document_signatures_profesional_id_fkey"
            columns: ["profesional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_info_checklist: {
        Row: {
          confirmado_at: string
          confirmado_por: string | null
          item_id: string
          patient_id: string
        }
        Insert: {
          confirmado_at?: string
          confirmado_por?: string | null
          item_id: string
          patient_id: string
        }
        Update: {
          confirmado_at?: string
          confirmado_por?: string | null
          item_id?: string
          patient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_info_checklist_confirmado_por_fkey"
            columns: ["confirmado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_info_checklist_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "info_checklist_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_info_checklist_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_info_checklist_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_control_frecuencia_diaria"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "patient_info_checklist_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_control_frecuencia_semanal"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "patient_info_checklist_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_prevalidacion_controles"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "patient_info_checklist_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_prevalidacion_facturacion"
            referencedColumns: ["patient_id"]
          },
        ]
      }
      patient_internaciones: {
        Row: {
          creado_por: string | null
          created_at: string
          diagnostico: string | null
          egreso_hecho_at: string | null
          estado: string
          fecha_egreso: string | null
          fecha_ingreso: string | null
          id: string
          llegada_confirmada_at: string | null
          motivo_egreso: Database["public"]["Enums"]["discharge_reason"] | null
          numero: number
          numero_afiliado: string | null
          obra_social_id: string | null
          patient_id: string
        }
        Insert: {
          creado_por?: string | null
          created_at?: string
          diagnostico?: string | null
          egreso_hecho_at?: string | null
          estado?: string
          fecha_egreso?: string | null
          fecha_ingreso?: string | null
          id?: string
          llegada_confirmada_at?: string | null
          motivo_egreso?: Database["public"]["Enums"]["discharge_reason"] | null
          numero?: number
          numero_afiliado?: string | null
          obra_social_id?: string | null
          patient_id: string
        }
        Update: {
          creado_por?: string | null
          created_at?: string
          diagnostico?: string | null
          egreso_hecho_at?: string | null
          estado?: string
          fecha_egreso?: string | null
          fecha_ingreso?: string | null
          id?: string
          llegada_confirmada_at?: string | null
          motivo_egreso?: Database["public"]["Enums"]["discharge_reason"] | null
          numero?: number
          numero_afiliado?: string | null
          obra_social_id?: string | null
          patient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_internaciones_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_internaciones_obra_social_id_fkey"
            columns: ["obra_social_id"]
            isOneToOne: false
            referencedRelation: "obras_sociales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_internaciones_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_internaciones_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_control_frecuencia_diaria"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "patient_internaciones_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_control_frecuencia_semanal"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "patient_internaciones_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_prevalidacion_controles"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "patient_internaciones_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_prevalidacion_facturacion"
            referencedColumns: ["patient_id"]
          },
        ]
      }
      patient_medications: {
        Row: {
          activo: boolean
          creado_por: string | null
          created_at: string
          dosis: string | null
          frecuencia: string | null
          id: string
          medicamento: string
          patient_id: string
          via: string | null
        }
        Insert: {
          activo?: boolean
          creado_por?: string | null
          created_at?: string
          dosis?: string | null
          frecuencia?: string | null
          id?: string
          medicamento: string
          patient_id: string
          via?: string | null
        }
        Update: {
          activo?: boolean
          creado_por?: string | null
          created_at?: string
          dosis?: string | null
          frecuencia?: string | null
          id?: string
          medicamento?: string
          patient_id?: string
          via?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_medications_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_medications_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_medications_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_control_frecuencia_diaria"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "patient_medications_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_control_frecuencia_semanal"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "patient_medications_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_prevalidacion_controles"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "patient_medications_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_prevalidacion_facturacion"
            referencedColumns: ["patient_id"]
          },
        ]
      }
      patient_messages: {
        Row: {
          autor_id: string
          created_at: string
          id: string
          mensaje: string
          patient_id: string
        }
        Insert: {
          autor_id?: string
          created_at?: string
          id?: string
          mensaje: string
          patient_id: string
        }
        Update: {
          autor_id?: string
          created_at?: string
          id?: string
          mensaje?: string
          patient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_messages_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_messages_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_messages_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_control_frecuencia_diaria"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "patient_messages_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_control_frecuencia_semanal"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "patient_messages_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_prevalidacion_controles"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "patient_messages_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_prevalidacion_facturacion"
            referencedColumns: ["patient_id"]
          },
        ]
      }
      patient_required_documents: {
        Row: {
          doc_id: string
          patient_id: string
          recibido_at: string
          recibido_por: string | null
        }
        Insert: {
          doc_id: string
          patient_id: string
          recibido_at?: string
          recibido_por?: string | null
        }
        Update: {
          doc_id?: string
          patient_id?: string
          recibido_at?: string
          recibido_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_required_documents_doc_id_fkey"
            columns: ["doc_id"]
            isOneToOne: false
            referencedRelation: "os_required_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_required_documents_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_required_documents_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_control_frecuencia_diaria"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "patient_required_documents_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_control_frecuencia_semanal"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "patient_required_documents_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_prevalidacion_controles"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "patient_required_documents_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_prevalidacion_facturacion"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "patient_required_documents_recibido_por_fkey"
            columns: ["recibido_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_status_history: {
        Row: {
          confirmado_por: string | null
          created_at: string
          evento: string
          fecha_evento: string
          id: string
          informado_at: string | null
          informado_por: string | null
          internacion_id: string | null
          motivo: Database["public"]["Enums"]["discharge_reason"] | null
          observaciones: string | null
          patient_id: string
        }
        Insert: {
          confirmado_por?: string | null
          created_at?: string
          evento: string
          fecha_evento?: string
          id?: string
          informado_at?: string | null
          informado_por?: string | null
          internacion_id?: string | null
          motivo?: Database["public"]["Enums"]["discharge_reason"] | null
          observaciones?: string | null
          patient_id: string
        }
        Update: {
          confirmado_por?: string | null
          created_at?: string
          evento?: string
          fecha_evento?: string
          id?: string
          informado_at?: string | null
          informado_por?: string | null
          internacion_id?: string | null
          motivo?: Database["public"]["Enums"]["discharge_reason"] | null
          observaciones?: string | null
          patient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_status_history_confirmado_por_fkey"
            columns: ["confirmado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_status_history_informado_por_fkey"
            columns: ["informado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_status_history_internacion_id_fkey"
            columns: ["internacion_id"]
            isOneToOne: false
            referencedRelation: "patient_internaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_status_history_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_status_history_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_control_frecuencia_diaria"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "patient_status_history_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_control_frecuencia_semanal"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "patient_status_history_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_prevalidacion_controles"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "patient_status_history_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_prevalidacion_facturacion"
            referencedColumns: ["patient_id"]
          },
        ]
      }
      patients: {
        Row: {
          contacto_familiar_nombre: string | null
          contacto_familiar_telefono: string | null
          coordinador_id: string | null
          created_at: string
          diagnostico_principal: string | null
          dni: string
          domicilio: string
          domicilio_actual: string | null
          egreso_hecho_at: string | null
          egreso_informado_at: string | null
          egreso_informado_por: string | null
          egreso_motivo_informado:
            | Database["public"]["Enums"]["discharge_reason"]
            | null
          estado: Database["public"]["Enums"]["patient_status"]
          fecha_egreso: string | null
          fecha_ingreso: string | null
          fecha_nacimiento: string | null
          frecuencia_reposicion: Database["public"]["Enums"]["replenishment_frequency"]
          id: string
          lat: number | null
          llegada_confirmada_at: string | null
          lng: number | null
          localidad: string | null
          medicacion_confirmada_at: string | null
          medico_derivante: string | null
          medico_matricula: string | null
          motivo_egreso: Database["public"]["Enums"]["discharge_reason"] | null
          nombre_completo: string
          nro_historia_clinica: number | null
          numero_afiliado: string | null
          obra_social: string | null
          obra_social_id: string | null
          ocupacion: string | null
          sexo: string | null
          telefono_actual: string | null
          telefono_contacto: string | null
          updated_at: string
        }
        Insert: {
          contacto_familiar_nombre?: string | null
          contacto_familiar_telefono?: string | null
          coordinador_id?: string | null
          created_at?: string
          diagnostico_principal?: string | null
          dni: string
          domicilio: string
          domicilio_actual?: string | null
          egreso_hecho_at?: string | null
          egreso_informado_at?: string | null
          egreso_informado_por?: string | null
          egreso_motivo_informado?:
            | Database["public"]["Enums"]["discharge_reason"]
            | null
          estado?: Database["public"]["Enums"]["patient_status"]
          fecha_egreso?: string | null
          fecha_ingreso?: string | null
          fecha_nacimiento?: string | null
          frecuencia_reposicion?: Database["public"]["Enums"]["replenishment_frequency"]
          id?: string
          lat?: number | null
          llegada_confirmada_at?: string | null
          lng?: number | null
          localidad?: string | null
          medicacion_confirmada_at?: string | null
          medico_derivante?: string | null
          medico_matricula?: string | null
          motivo_egreso?: Database["public"]["Enums"]["discharge_reason"] | null
          nombre_completo: string
          nro_historia_clinica?: number | null
          numero_afiliado?: string | null
          obra_social?: string | null
          obra_social_id?: string | null
          ocupacion?: string | null
          sexo?: string | null
          telefono_actual?: string | null
          telefono_contacto?: string | null
          updated_at?: string
        }
        Update: {
          contacto_familiar_nombre?: string | null
          contacto_familiar_telefono?: string | null
          coordinador_id?: string | null
          created_at?: string
          diagnostico_principal?: string | null
          dni?: string
          domicilio?: string
          domicilio_actual?: string | null
          egreso_hecho_at?: string | null
          egreso_informado_at?: string | null
          egreso_informado_por?: string | null
          egreso_motivo_informado?:
            | Database["public"]["Enums"]["discharge_reason"]
            | null
          estado?: Database["public"]["Enums"]["patient_status"]
          fecha_egreso?: string | null
          fecha_ingreso?: string | null
          fecha_nacimiento?: string | null
          frecuencia_reposicion?: Database["public"]["Enums"]["replenishment_frequency"]
          id?: string
          lat?: number | null
          llegada_confirmada_at?: string | null
          lng?: number | null
          localidad?: string | null
          medicacion_confirmada_at?: string | null
          medico_derivante?: string | null
          medico_matricula?: string | null
          motivo_egreso?: Database["public"]["Enums"]["discharge_reason"] | null
          nombre_completo?: string
          nro_historia_clinica?: number | null
          numero_afiliado?: string | null
          obra_social?: string | null
          obra_social_id?: string | null
          ocupacion?: string | null
          sexo?: string | null
          telefono_actual?: string | null
          telefono_contacto?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patients_coordinador_id_fkey"
            columns: ["coordinador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patients_egreso_informado_por_fkey"
            columns: ["egreso_informado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patients_obra_social_id_fkey"
            columns: ["obra_social_id"]
            isOneToOne: false
            referencedRelation: "obras_sociales"
            referencedColumns: ["id"]
          },
        ]
      }
      product_price_history: {
        Row: {
          id: number
          precio_compra: number
          product_id: string
          vigente_desde: string
        }
        Insert: {
          id?: never
          precio_compra: number
          product_id: string
          vigente_desde?: string
        }
        Update: {
          id?: never
          precio_compra?: number
          product_id?: string
          vigente_desde?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_price_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_price_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_disponibilidad_deposito"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_price_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_products_status"
            referencedColumns: ["id"]
          },
        ]
      }
      product_suppliers: {
        Row: {
          created_at: string
          precio_referencia: number | null
          preferido: boolean
          product_id: string
          supplier_id: string
        }
        Insert: {
          created_at?: string
          precio_referencia?: number | null
          preferido?: boolean
          product_id: string
          supplier_id: string
        }
        Update: {
          created_at?: string
          precio_referencia?: number | null
          preferido?: boolean
          product_id?: string
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_suppliers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_suppliers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_disponibilidad_deposito"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_suppliers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_products_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_suppliers_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          categoria_iva: Database["public"]["Enums"]["iva_category"]
          codigo: string
          created_at: string
          descripcion: string
          ean: string | null
          existencia_actual: number
          fecha_ultimo_service: string | null
          fecha_vencimiento: string | null
          frecuencia_service: string | null
          id: string
          n_lote: string | null
          observacion: string | null
          precio_alquiler_mensual: number | null
          proveedor: string | null
          se_factura_aparte: boolean
          stock_maximo: number | null
          stock_minimo: number | null
          supplier_id: string | null
          tipo: Database["public"]["Enums"]["product_type"]
          vida_util_estimada: string | null
        }
        Insert: {
          active?: boolean
          categoria_iva?: Database["public"]["Enums"]["iva_category"]
          codigo: string
          created_at?: string
          descripcion: string
          ean?: string | null
          existencia_actual?: number
          fecha_ultimo_service?: string | null
          fecha_vencimiento?: string | null
          frecuencia_service?: string | null
          id?: string
          n_lote?: string | null
          observacion?: string | null
          precio_alquiler_mensual?: number | null
          proveedor?: string | null
          se_factura_aparte?: boolean
          stock_maximo?: number | null
          stock_minimo?: number | null
          supplier_id?: string | null
          tipo: Database["public"]["Enums"]["product_type"]
          vida_util_estimada?: string | null
        }
        Update: {
          active?: boolean
          categoria_iva?: Database["public"]["Enums"]["iva_category"]
          codigo?: string
          created_at?: string
          descripcion?: string
          ean?: string | null
          existencia_actual?: number
          fecha_ultimo_service?: string | null
          fecha_vencimiento?: string | null
          frecuencia_service?: string | null
          id?: string
          n_lote?: string | null
          observacion?: string | null
          precio_alquiler_mensual?: number | null
          proveedor?: string | null
          se_factura_aparte?: boolean
          stock_maximo?: number | null
          stock_minimo?: number | null
          supplier_id?: string | null
          tipo?: Database["public"]["Enums"]["product_type"]
          vida_util_estimada?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          created_at: string
          dni: string | null
          email_contacto: string | null
          especialidad: Database["public"]["Enums"]["specialty"] | null
          fecha_baja: string | null
          fecha_ingreso: string | null
          full_name: string
          id: string
          last_login_at: string | null
          matricula: string | null
          role: Database["public"]["Enums"]["app_role"]
          telefono: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          dni?: string | null
          email_contacto?: string | null
          especialidad?: Database["public"]["Enums"]["specialty"] | null
          fecha_baja?: string | null
          fecha_ingreso?: string | null
          full_name: string
          id: string
          last_login_at?: string | null
          matricula?: string | null
          role: Database["public"]["Enums"]["app_role"]
          telefono?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          dni?: string | null
          email_contacto?: string | null
          especialidad?: Database["public"]["Enums"]["specialty"] | null
          fecha_baja?: string | null
          fecha_ingreso?: string | null
          full_name?: string
          id?: string
          last_login_at?: string | null
          matricula?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          telefono?: string | null
        }
        Relationships: []
      }
      purchase_order_invoice_items: {
        Row: {
          cantidad_facturada: number
          id: number
          invoice_id: string
          precio_unitario_facturado: number
          product_id: string
        }
        Insert: {
          cantidad_facturada: number
          id?: never
          invoice_id: string
          precio_unitario_facturado: number
          product_id: string
        }
        Update: {
          cantidad_facturada?: number
          id?: never
          invoice_id?: string
          precio_unitario_facturado?: number
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "purchase_order_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_invoice_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_invoice_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_disponibilidad_deposito"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "purchase_order_invoice_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_products_status"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_invoices: {
        Row: {
          cargada_por: string | null
          created_at: string
          fecha_factura: string
          id: string
          monto_total: number
          numero_factura: string
          purchase_order_id: string
        }
        Insert: {
          cargada_por?: string | null
          created_at?: string
          fecha_factura: string
          id?: string
          monto_total: number
          numero_factura: string
          purchase_order_id: string
        }
        Update: {
          cargada_por?: string | null
          created_at?: string
          fecha_factura?: string
          id?: string
          monto_total?: number
          numero_factura?: string
          purchase_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_invoices_cargada_por_fkey"
            columns: ["cargada_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_invoices_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: true
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_items: {
        Row: {
          cantidad: number
          created_at: string
          id: number
          precio_unitario: number | null
          product_id: string
          purchase_order_id: string
        }
        Insert: {
          cantidad?: number
          created_at?: string
          id?: never
          precio_unitario?: number | null
          product_id: string
          purchase_order_id: string
        }
        Update: {
          cantidad?: number
          created_at?: string
          id?: never
          precio_unitario?: number | null
          product_id?: string
          purchase_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_disponibilidad_deposito"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_products_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          creado_por: string | null
          created_at: string
          estado: Database["public"]["Enums"]["purchase_order_status"]
          fecha_recepcion: string | null
          id: string
          supplier_id: string
        }
        Insert: {
          creado_por?: string | null
          created_at?: string
          estado?: Database["public"]["Enums"]["purchase_order_status"]
          fecha_recepcion?: string | null
          id?: string
          supplier_id: string
        }
        Update: {
          creado_por?: string | null
          created_at?: string
          estado?: Database["public"]["Enums"]["purchase_order_status"]
          fecha_recepcion?: string | null
          id?: string
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_request_items: {
        Row: {
          cantidad: number
          created_at: string
          id: number
          product_id: string
          quote_request_id: string
        }
        Insert: {
          cantidad?: number
          created_at?: string
          id?: never
          product_id: string
          quote_request_id: string
        }
        Update: {
          cantidad?: number
          created_at?: string
          id?: never
          product_id?: string
          quote_request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_request_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_request_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_disponibilidad_deposito"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "quote_request_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_products_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_request_items_quote_request_id_fkey"
            columns: ["quote_request_id"]
            isOneToOne: false
            referencedRelation: "quote_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_requests: {
        Row: {
          creado_por: string | null
          created_at: string
          estado: Database["public"]["Enums"]["quote_request_status"]
          id: string
          notas: string | null
        }
        Insert: {
          creado_por?: string | null
          created_at?: string
          estado?: Database["public"]["Enums"]["quote_request_status"]
          id?: string
          notas?: string | null
        }
        Update: {
          creado_por?: string | null
          created_at?: string
          estado?: Database["public"]["Enums"]["quote_request_status"]
          id?: string
          notas?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_requests_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      remitos: {
        Row: {
          entrega_lat: number | null
          entrega_lng: number | null
          fecha_despacho: string | null
          fecha_entrega: string | null
          firma_familiar_url: string | null
          firmado_at: string | null
          firmante_dni: string | null
          firmante_nombre: string | null
          firmante_vinculo: string | null
          id: string
          notificacion_canal: string | null
          notificacion_enviada_at: string | null
          order_id: string
          transportista_id: string | null
        }
        Insert: {
          entrega_lat?: number | null
          entrega_lng?: number | null
          fecha_despacho?: string | null
          fecha_entrega?: string | null
          firma_familiar_url?: string | null
          firmado_at?: string | null
          firmante_dni?: string | null
          firmante_nombre?: string | null
          firmante_vinculo?: string | null
          id?: string
          notificacion_canal?: string | null
          notificacion_enviada_at?: string | null
          order_id: string
          transportista_id?: string | null
        }
        Update: {
          entrega_lat?: number | null
          entrega_lng?: number | null
          fecha_despacho?: string | null
          fecha_entrega?: string | null
          firma_familiar_url?: string | null
          firmado_at?: string | null
          firmante_dni?: string | null
          firmante_nombre?: string | null
          firmante_vinculo?: string | null
          id?: string
          notificacion_canal?: string | null
          notificacion_enviada_at?: string | null
          order_id?: string
          transportista_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "remitos_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remitos_transportista_id_fkey"
            columns: ["transportista_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      retrieval_checklist: {
        Row: {
          agregado_por: string | null
          anulado_at: string | null
          anulado_por: string | null
          asset_id: string | null
          cantidad: number | null
          discharge_alert_id: string
          foto_url: string | null
          id: number
          llego_deposito_at: string | null
          llego_deposito_confirmado_por: string | null
          llego_lat: number | null
          llego_lng: number | null
          nota: string | null
          product_id: string | null
          reasignado_at: string | null
          reasignado_patient_id: string | null
          retirado_at: string | null
          retirado_por: string | null
          retiro_condicion: string | null
          retiro_lat: number | null
          retiro_lng: number | null
        }
        Insert: {
          agregado_por?: string | null
          anulado_at?: string | null
          anulado_por?: string | null
          asset_id?: string | null
          cantidad?: number | null
          discharge_alert_id: string
          foto_url?: string | null
          id?: never
          llego_deposito_at?: string | null
          llego_deposito_confirmado_por?: string | null
          llego_lat?: number | null
          llego_lng?: number | null
          nota?: string | null
          product_id?: string | null
          reasignado_at?: string | null
          reasignado_patient_id?: string | null
          retirado_at?: string | null
          retirado_por?: string | null
          retiro_condicion?: string | null
          retiro_lat?: number | null
          retiro_lng?: number | null
        }
        Update: {
          agregado_por?: string | null
          anulado_at?: string | null
          anulado_por?: string | null
          asset_id?: string | null
          cantidad?: number | null
          discharge_alert_id?: string
          foto_url?: string | null
          id?: never
          llego_deposito_at?: string | null
          llego_deposito_confirmado_por?: string | null
          llego_lat?: number | null
          llego_lng?: number | null
          nota?: string | null
          product_id?: string | null
          reasignado_at?: string | null
          reasignado_patient_id?: string | null
          retirado_at?: string | null
          retirado_por?: string | null
          retiro_condicion?: string | null
          retiro_lat?: number | null
          retiro_lng?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "retrieval_checklist_agregado_por_fkey"
            columns: ["agregado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retrieval_checklist_anulado_por_fkey"
            columns: ["anulado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retrieval_checklist_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "equipment_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retrieval_checklist_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "v_equipos_en_domicilio"
            referencedColumns: ["asset_id"]
          },
          {
            foreignKeyName: "retrieval_checklist_discharge_alert_id_fkey"
            columns: ["discharge_alert_id"]
            isOneToOne: false
            referencedRelation: "discharge_alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retrieval_checklist_llego_deposito_confirmado_por_fkey"
            columns: ["llego_deposito_confirmado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retrieval_checklist_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retrieval_checklist_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_disponibilidad_deposito"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "retrieval_checklist_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_products_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retrieval_checklist_reasignado_patient_id_fkey"
            columns: ["reasignado_patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retrieval_checklist_reasignado_patient_id_fkey"
            columns: ["reasignado_patient_id"]
            isOneToOne: false
            referencedRelation: "v_control_frecuencia_diaria"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "retrieval_checklist_reasignado_patient_id_fkey"
            columns: ["reasignado_patient_id"]
            isOneToOne: false
            referencedRelation: "v_control_frecuencia_semanal"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "retrieval_checklist_reasignado_patient_id_fkey"
            columns: ["reasignado_patient_id"]
            isOneToOne: false
            referencedRelation: "v_prevalidacion_controles"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "retrieval_checklist_reasignado_patient_id_fkey"
            columns: ["reasignado_patient_id"]
            isOneToOne: false
            referencedRelation: "v_prevalidacion_facturacion"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "retrieval_checklist_retirado_por_fkey"
            columns: ["retirado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_quote_items: {
        Row: {
          cantidad: number
          created_at: string
          descripcion: string
          id: number
          orden: number
          quote_id: string
          valor_unitario: number
        }
        Insert: {
          cantidad: number
          created_at?: string
          descripcion: string
          id?: never
          orden?: number
          quote_id: string
          valor_unitario: number
        }
        Update: {
          cantidad?: number
          created_at?: string
          descripcion?: string
          id?: never
          orden?: number
          quote_id?: string
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "sales_quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_quotes: {
        Row: {
          creado_por: string | null
          created_at: string
          destinatario_particular: string | null
          fecha: string
          id: string
          notas: string | null
          numero: number
          obra_social_id: string | null
          validez_dias: number
        }
        Insert: {
          creado_por?: string | null
          created_at?: string
          destinatario_particular?: string | null
          fecha?: string
          id?: string
          notas?: string | null
          numero?: never
          obra_social_id?: string | null
          validez_dias?: number
        }
        Update: {
          creado_por?: string | null
          created_at?: string
          destinatario_particular?: string | null
          fecha?: string
          id?: string
          notas?: string | null
          numero?: never
          obra_social_id?: string | null
          validez_dias?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_quotes_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_quotes_obra_social_id_fkey"
            columns: ["obra_social_id"]
            isOneToOne: false
            referencedRelation: "obras_sociales"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          cantidad: number
          confirmado_por: string | null
          fecha: string
          id: number
          motivo: string | null
          order_id: string | null
          product_id: string
          purchase_order_item_id: number | null
          tipo: Database["public"]["Enums"]["stock_movement_type"]
        }
        Insert: {
          cantidad: number
          confirmado_por?: string | null
          fecha?: string
          id?: never
          motivo?: string | null
          order_id?: string | null
          product_id: string
          purchase_order_item_id?: number | null
          tipo: Database["public"]["Enums"]["stock_movement_type"]
        }
        Update: {
          cantidad?: number
          confirmado_por?: string | null
          fecha?: string
          id?: never
          motivo?: string | null
          order_id?: string | null
          product_id?: string
          purchase_order_item_id?: number | null
          tipo?: Database["public"]["Enums"]["stock_movement_type"]
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_confirmado_por_fkey"
            columns: ["confirmado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_disponibilidad_deposito"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_products_status"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_price_quotes: {
        Row: {
          created_at: string
          id: number
          precio: number
          product_id: string
          quote_request_id: string | null
          supplier_id: string
          vigente_desde: string
        }
        Insert: {
          created_at?: string
          id?: never
          precio: number
          product_id: string
          quote_request_id?: string | null
          supplier_id: string
          vigente_desde?: string
        }
        Update: {
          created_at?: string
          id?: never
          precio?: number
          product_id?: string
          quote_request_id?: string | null
          supplier_id?: string
          vigente_desde?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_price_quotes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_price_quotes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_disponibilidad_deposito"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "supplier_price_quotes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_products_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_price_quotes_quote_request_id_fkey"
            columns: ["quote_request_id"]
            isOneToOne: false
            referencedRelation: "quote_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_price_quotes_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          activo: boolean
          created_at: string
          cuit: string | null
          email: string | null
          id: string
          nombre: string
          telefono: string | null
        }
        Insert: {
          activo?: boolean
          created_at?: string
          cuit?: string | null
          email?: string | null
          id?: string
          nombre: string
          telefono?: string | null
        }
        Update: {
          activo?: boolean
          created_at?: string
          cuit?: string | null
          email?: string | null
          id?: string
          nombre?: string
          telefono?: string | null
        }
        Relationships: []
      }
      transport_task_runs: {
        Row: {
          completada_at: string
          completada_por: string | null
          fecha: string
          nota: string | null
          task_id: string
        }
        Insert: {
          completada_at?: string
          completada_por?: string | null
          fecha: string
          nota?: string | null
          task_id: string
        }
        Update: {
          completada_at?: string
          completada_por?: string | null
          fecha?: string
          nota?: string | null
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transport_task_runs_completada_por_fkey"
            columns: ["completada_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_task_runs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "transport_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_tasks: {
        Row: {
          aviso_en_camino_at: string | null
          completada_at: string | null
          contacto: string | null
          creado_por: string | null
          created_at: string
          descripcion: string | null
          dias_semana: number[] | null
          direccion: string | null
          duracion_min: number
          estado: string
          fecha: string
          hora: string | null
          id: string
          iniciada_at: string | null
          nota_reprogramacion: string | null
          order_id: string | null
          patient_id: string | null
          permanente: boolean
          prioridad: string
          repeticion: string | null
          reprogramaciones: number
          reprogramada_desde: string | null
          telefono: string | null
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          aviso_en_camino_at?: string | null
          completada_at?: string | null
          contacto?: string | null
          creado_por?: string | null
          created_at?: string
          descripcion?: string | null
          dias_semana?: number[] | null
          direccion?: string | null
          duracion_min?: number
          estado?: string
          fecha?: string
          hora?: string | null
          id?: string
          iniciada_at?: string | null
          nota_reprogramacion?: string | null
          order_id?: string | null
          patient_id?: string | null
          permanente?: boolean
          prioridad?: string
          repeticion?: string | null
          reprogramaciones?: number
          reprogramada_desde?: string | null
          telefono?: string | null
          tipo?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          aviso_en_camino_at?: string | null
          completada_at?: string | null
          contacto?: string | null
          creado_por?: string | null
          created_at?: string
          descripcion?: string | null
          dias_semana?: number[] | null
          direccion?: string | null
          duracion_min?: number
          estado?: string
          fecha?: string
          hora?: string | null
          id?: string
          iniciada_at?: string | null
          nota_reprogramacion?: string | null
          order_id?: string | null
          patient_id?: string | null
          permanente?: boolean
          prioridad?: string
          repeticion?: string | null
          reprogramaciones?: number
          reprogramada_desde?: string | null
          telefono?: string | null
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transport_tasks_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_tasks_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_tasks_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_tasks_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_control_frecuencia_diaria"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "transport_tasks_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_control_frecuencia_semanal"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "transport_tasks_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_prevalidacion_controles"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "transport_tasks_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_prevalidacion_facturacion"
            referencedColumns: ["patient_id"]
          },
        ]
      }
      treatment_authorizations: {
        Row: {
          autorizado_por: string | null
          cantidad_autorizada: number
          created_at: string
          dias_semana: number[] | null
          especialidad: Database["public"]["Enums"]["specialty"]
          frecuencia_tipo: string | null
          id: number
          patient_id: string
          periodo_desde: string
          periodo_hasta: string
          practica: string
          veces_por_dia: number | null
        }
        Insert: {
          autorizado_por?: string | null
          cantidad_autorizada: number
          created_at?: string
          dias_semana?: number[] | null
          especialidad: Database["public"]["Enums"]["specialty"]
          frecuencia_tipo?: string | null
          id?: never
          patient_id: string
          periodo_desde?: string
          periodo_hasta: string
          practica: string
          veces_por_dia?: number | null
        }
        Update: {
          autorizado_por?: string | null
          cantidad_autorizada?: number
          created_at?: string
          dias_semana?: number[] | null
          especialidad?: Database["public"]["Enums"]["specialty"]
          frecuencia_tipo?: string | null
          id?: never
          patient_id?: string
          periodo_desde?: string
          periodo_hasta?: string
          practica?: string
          veces_por_dia?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "treatment_authorizations_autorizado_por_fkey"
            columns: ["autorizado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_authorizations_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_authorizations_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_control_frecuencia_diaria"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "treatment_authorizations_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_control_frecuencia_semanal"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "treatment_authorizations_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_prevalidacion_controles"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "treatment_authorizations_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_prevalidacion_facturacion"
            referencedColumns: ["patient_id"]
          },
        ]
      }
      treatment_plans: {
        Row: {
          activo: boolean
          cantidad: number
          creado_por: string | null
          created_at: string
          desde: string
          dias_semana: number[] | null
          especialidad: Database["public"]["Enums"]["specialty"]
          hasta: string | null
          id: string
          nota: string | null
          patient_id: string
          reemplaza_id: string | null
          unidad: string
        }
        Insert: {
          activo?: boolean
          cantidad: number
          creado_por?: string | null
          created_at?: string
          desde?: string
          dias_semana?: number[] | null
          especialidad: Database["public"]["Enums"]["specialty"]
          hasta?: string | null
          id?: string
          nota?: string | null
          patient_id: string
          reemplaza_id?: string | null
          unidad: string
        }
        Update: {
          activo?: boolean
          cantidad?: number
          creado_por?: string | null
          created_at?: string
          desde?: string
          dias_semana?: number[] | null
          especialidad?: Database["public"]["Enums"]["specialty"]
          hasta?: string | null
          id?: string
          nota?: string | null
          patient_id?: string
          reemplaza_id?: string | null
          unidad?: string
        }
        Relationships: [
          {
            foreignKeyName: "treatment_plans_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_plans_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_plans_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_control_frecuencia_diaria"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "treatment_plans_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_control_frecuencia_semanal"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "treatment_plans_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_prevalidacion_controles"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "treatment_plans_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_prevalidacion_facturacion"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "treatment_plans_reemplaza_id_fkey"
            columns: ["reemplaza_id"]
            isOneToOne: false
            referencedRelation: "treatment_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      turno_guardia: {
        Row: {
          conformidad_firma: string | null
          conformidad_nombre: string | null
          created_at: string
          estado: string
          firma_profesional_img: string | null
          firma_profesional_matricula: string | null
          firma_profesional_nombre: string | null
          hora_egreso: string | null
          hora_ingreso: string
          id: string
          narrativa: string | null
          patient_id: string
          profesional_id: string
        }
        Insert: {
          conformidad_firma?: string | null
          conformidad_nombre?: string | null
          created_at?: string
          estado?: string
          firma_profesional_img?: string | null
          firma_profesional_matricula?: string | null
          firma_profesional_nombre?: string | null
          hora_egreso?: string | null
          hora_ingreso?: string
          id?: string
          narrativa?: string | null
          patient_id: string
          profesional_id?: string
        }
        Update: {
          conformidad_firma?: string | null
          conformidad_nombre?: string | null
          created_at?: string
          estado?: string
          firma_profesional_img?: string | null
          firma_profesional_matricula?: string | null
          firma_profesional_nombre?: string | null
          hora_egreso?: string | null
          hora_ingreso?: string
          id?: string
          narrativa?: string | null
          patient_id?: string
          profesional_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "turno_guardia_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turno_guardia_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_control_frecuencia_diaria"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "turno_guardia_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_control_frecuencia_semanal"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "turno_guardia_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_prevalidacion_controles"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "turno_guardia_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_prevalidacion_facturacion"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "turno_guardia_profesional_id_fkey"
            columns: ["profesional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      turno_guardia_controles: {
        Row: {
          ax: number | null
          created_by: string
          fc: number | null
          fr: number | null
          hora: string
          id: string
          pa: string | null
          turno_id: string
        }
        Insert: {
          ax?: number | null
          created_by?: string
          fc?: number | null
          fr?: number | null
          hora?: string
          id?: string
          pa?: string | null
          turno_id: string
        }
        Update: {
          ax?: number | null
          created_by?: string
          fc?: number | null
          fr?: number | null
          hora?: string
          id?: string
          pa?: string | null
          turno_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "turno_guardia_controles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turno_guardia_controles_turno_id_fkey"
            columns: ["turno_id"]
            isOneToOne: false
            referencedRelation: "turno_guardia"
            referencedColumns: ["id"]
          },
        ]
      }
      visits: {
        Row: {
          abierta_at: string | null
          abierta_lat: number | null
          abierta_lng: number | null
          cerrada_at: string | null
          creado_por: string | null
          created_at: string
          especialidad: Database["public"]["Enums"]["specialty"]
          estado: Database["public"]["Enums"]["visit_status"]
          fecha_programada: string
          fecha_realizada: string | null
          franja: string | null
          hora_desde: string | null
          hora_hasta: string | null
          id: string
          motivo_reprogramacion: string | null
          observacion_agenda: string | null
          patient_id: string
          profesional_id: string
          recordatorio_enviado_at: string | null
          sin_hora: boolean
        }
        Insert: {
          abierta_at?: string | null
          abierta_lat?: number | null
          abierta_lng?: number | null
          cerrada_at?: string | null
          creado_por?: string | null
          created_at?: string
          especialidad: Database["public"]["Enums"]["specialty"]
          estado?: Database["public"]["Enums"]["visit_status"]
          fecha_programada: string
          fecha_realizada?: string | null
          franja?: string | null
          hora_desde?: string | null
          hora_hasta?: string | null
          id?: string
          motivo_reprogramacion?: string | null
          observacion_agenda?: string | null
          patient_id: string
          profesional_id: string
          recordatorio_enviado_at?: string | null
          sin_hora?: boolean
        }
        Update: {
          abierta_at?: string | null
          abierta_lat?: number | null
          abierta_lng?: number | null
          cerrada_at?: string | null
          creado_por?: string | null
          created_at?: string
          especialidad?: Database["public"]["Enums"]["specialty"]
          estado?: Database["public"]["Enums"]["visit_status"]
          fecha_programada?: string
          fecha_realizada?: string | null
          franja?: string | null
          hora_desde?: string | null
          hora_hasta?: string | null
          id?: string
          motivo_reprogramacion?: string | null
          observacion_agenda?: string | null
          patient_id?: string
          profesional_id?: string
          recordatorio_enviado_at?: string | null
          sin_hora?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "visits_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_control_frecuencia_diaria"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "visits_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_control_frecuencia_semanal"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "visits_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_prevalidacion_controles"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "visits_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_prevalidacion_facturacion"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "visits_profesional_id_fkey"
            columns: ["profesional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_cierre_sugerido: {
        Row: {
          billing_period_id: string | null
          modalidad_facturacion: string | null
          modulos_en_curso: number | null
          modulos_verdes: number | null
          obra_social_id: string | null
          pacientes_excluidos: number | null
          pacientes_rojos: number | null
          total_proyectado: number | null
          total_sugerido: number | null
          valor_vigente: number | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_periods_obra_social_id_fkey"
            columns: ["obra_social_id"]
            isOneToOne: false
            referencedRelation: "obras_sociales"
            referencedColumns: ["id"]
          },
        ]
      }
      v_control_frecuencia_diaria: {
        Row: {
          cargadas: number | null
          especialidad: string | null
          esperadas: number | null
          fecha: string | null
          nombre_completo: string | null
          patient_id: string | null
          practica: string | null
          treatment_authorization_id: number | null
        }
        Relationships: []
      }
      v_control_frecuencia_semanal: {
        Row: {
          cargadas: number | null
          dias_semana: number[] | null
          especialidad: string | null
          esperadas: number | null
          nombre_completo: string | null
          patient_id: string | null
          practica: string | null
          semana_desde: string | null
          semana_hasta: string | null
          treatment_authorization_id: number | null
        }
        Relationships: []
      }
      v_costos_por_paciente: {
        Row: {
          costo_estimado: number | null
          nombre_completo: string | null
          obra_social: string | null
          patient_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_authorizations_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_authorizations_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_control_frecuencia_diaria"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "patient_authorizations_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_control_frecuencia_semanal"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "patient_authorizations_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_prevalidacion_controles"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "patient_authorizations_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_prevalidacion_facturacion"
            referencedColumns: ["patient_id"]
          },
        ]
      }
      v_disponibilidad_deposito: {
        Row: {
          codigo: string | null
          descripcion: string | null
          existencia_actual: number | null
          product_id: string | null
          tipo: Database["public"]["Enums"]["product_type"] | null
          unidades_disponibles: number | null
        }
        Relationships: []
      }
      v_equipos_en_domicilio: {
        Row: {
          asset_id: string | null
          descripcion: string | null
          desde: string | null
          domicilio_destino: string | null
          estado: Database["public"]["Enums"]["asset_status"] | null
          nombre_completo: string | null
          numero_serie: string | null
          patient_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_asset_movements_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_asset_movements_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_control_frecuencia_diaria"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "equipment_asset_movements_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_control_frecuencia_semanal"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "equipment_asset_movements_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_prevalidacion_controles"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "equipment_asset_movements_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_prevalidacion_facturacion"
            referencedColumns: ["patient_id"]
          },
        ]
      }
      v_equipos_retirados_sin_confirmar: {
        Row: {
          checklist_id: number | null
          descripcion: string | null
          egreso_notificado_at: string | null
          numero_serie: string | null
          retirado_at: string | null
          retirado_por: string | null
          vencido_48h: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "retrieval_checklist_retirado_por_fkey"
            columns: ["retirado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      v_hc_sin_firmas: {
        Row: {
          created_at: string | null
          especialidad: Database["public"]["Enums"]["specialty"] | null
          evolution_id: string | null
          falta_conformidad: boolean | null
          falta_firma_profesional: boolean | null
          patient_id: string | null
          profesional_id: string | null
          visit_id: string | null
        }
        Insert: {
          created_at?: string | null
          especialidad?: Database["public"]["Enums"]["specialty"] | null
          evolution_id?: string | null
          falta_conformidad?: never
          falta_firma_profesional?: never
          patient_id?: string | null
          profesional_id?: string | null
          visit_id?: string | null
        }
        Update: {
          created_at?: string | null
          especialidad?: Database["public"]["Enums"]["specialty"] | null
          evolution_id?: string | null
          falta_conformidad?: never
          falta_firma_profesional?: never
          patient_id?: string | null
          profesional_id?: string | null
          visit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evolutions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evolutions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_control_frecuencia_diaria"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "evolutions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_control_frecuencia_semanal"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "evolutions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_prevalidacion_controles"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "evolutions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_prevalidacion_facturacion"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "evolutions_profesional_id_fkey"
            columns: ["profesional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evolutions_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "v_visit_evolution_discrepancies"
            referencedColumns: ["visit_id"]
          },
          {
            foreignKeyName: "evolutions_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      v_hc_visitas_vs_plan: {
        Row: {
          especialidad: Database["public"]["Enums"]["specialty"] | null
          esperadas: number | null
          estado: string | null
          patient_id: string | null
          realizadas: number | null
          semana_desde: string | null
        }
        Relationships: [
          {
            foreignKeyName: "treatment_plans_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_plans_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_control_frecuencia_diaria"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "treatment_plans_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_control_frecuencia_semanal"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "treatment_plans_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_prevalidacion_controles"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "treatment_plans_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_prevalidacion_facturacion"
            referencedColumns: ["patient_id"]
          },
        ]
      }
      v_historial_precios_proveedor: {
        Row: {
          fecha: string | null
          origen: string | null
          precio: number | null
          product_id: string | null
          supplier_id: string | null
        }
        Relationships: []
      }
      v_historial_precios_proveedor_resumen: {
        Row: {
          cantidad_registros: number | null
          precio_minimo: number | null
          product_id: string | null
          supplier_id: string | null
          ultima_fecha: string | null
          ultimo_precio: number | null
        }
        Relationships: []
      }
      v_prevalidacion_controles: {
        Row: {
          billing_period_id: string | null
          evoluciones_mes: number | null
          nombre_completo: string | null
          patient_id: string | null
          sin_conformidad_familiar: number | null
          sin_firma_profesional: number | null
          visitas_sin_evolucion: number | null
        }
        Relationships: []
      }
      v_prevalidacion_facturacion: {
        Row: {
          billing_period_id: string | null
          cantidad_autorizada: number | null
          dia_corte: string | null
          dias_aun_no_llego: number | null
          dias_semana: number[] | null
          dias_sin_evolucion_inicio: number | null
          egreso_informado_at: string | null
          especialidad: Database["public"]["Enums"]["specialty"] | null
          estado_control: string | null
          estado_prevalidacion: string | null
          evoluciones_cargadas_mes: number | null
          evoluciones_cargadas_ventana: number | null
          evoluciones_dia_no_autorizado: number | null
          evoluciones_esperadas_ajustadas: number | null
          evoluciones_esperadas_mes: number | null
          evoluciones_exceso: number | null
          evoluciones_post_egreso: number | null
          frecuencia_tipo: string | null
          llegada_confirmada_at: string | null
          motivo_faltante: string | null
          nombre_completo: string | null
          obra_social_id: string | null
          overlap_desde: string | null
          overlap_hasta: string | null
          paciente_estado: string | null
          paciente_fecha_egreso: string | null
          paciente_fecha_ingreso: string | null
          patient_id: string | null
          periodo: string | null
          periodo_desde: string | null
          periodo_hasta: string | null
          practica: string | null
          treatment_authorization_id: number | null
          veces_por_dia: number | null
          ventana_desde: string | null
          ventana_hasta: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_periods_obra_social_id_fkey"
            columns: ["obra_social_id"]
            isOneToOne: false
            referencedRelation: "obras_sociales"
            referencedColumns: ["id"]
          },
        ]
      }
      v_prevalidacion_insumos: {
        Row: {
          billing_period_id: string | null
          cantidad_autorizada: number | null
          cantidad_entregada: number | null
          codigo: string | null
          descripcion: string | null
          estado_control: string | null
          nombre_completo: string | null
          patient_id: string | null
          product_id: string | null
          tipo: string | null
        }
        Relationships: []
      }
      v_prevalidacion_resumen: {
        Row: {
          amarillos: number | null
          billing_period_id: string | null
          bloqueado: boolean | null
          bloqueado_efectivo: boolean | null
          pacientes_rojos: number | null
          pacientes_rojos_excluidos: number | null
          pacientes_rojos_pendientes: number | null
          pacientes_total: number | null
          rojos: number | null
          verdes: number | null
        }
        Relationships: []
      }
      v_products_status: {
        Row: {
          active: boolean | null
          categoria_iva: Database["public"]["Enums"]["iva_category"] | null
          codigo: string | null
          created_at: string | null
          descripcion: string | null
          ean: string | null
          estado_stock: Database["public"]["Enums"]["stock_level_status"] | null
          estado_vencimiento:
            | Database["public"]["Enums"]["authorization_status"]
            | null
          existencia_actual: number | null
          fecha_ultimo_service: string | null
          fecha_vencimiento: string | null
          frecuencia_service: string | null
          id: string | null
          n_lote: string | null
          observacion: string | null
          precio_alquiler_mensual: number | null
          proveedor: string | null
          se_factura_aparte: boolean | null
          stock_maximo: number | null
          stock_minimo: number | null
          supplier_id: string | null
          tipo: Database["public"]["Enums"]["product_type"] | null
          vida_util_estimada: string | null
        }
        Insert: {
          active?: boolean | null
          categoria_iva?: Database["public"]["Enums"]["iva_category"] | null
          codigo?: string | null
          created_at?: string | null
          descripcion?: string | null
          ean?: string | null
          estado_stock?: never
          estado_vencimiento?: never
          existencia_actual?: number | null
          fecha_ultimo_service?: string | null
          fecha_vencimiento?: string | null
          frecuencia_service?: string | null
          id?: string | null
          n_lote?: string | null
          observacion?: string | null
          precio_alquiler_mensual?: number | null
          proveedor?: string | null
          se_factura_aparte?: boolean | null
          stock_maximo?: number | null
          stock_minimo?: number | null
          supplier_id?: string | null
          tipo?: Database["public"]["Enums"]["product_type"] | null
          vida_util_estimada?: string | null
        }
        Update: {
          active?: boolean | null
          categoria_iva?: Database["public"]["Enums"]["iva_category"] | null
          codigo?: string | null
          created_at?: string | null
          descripcion?: string | null
          ean?: string | null
          estado_stock?: never
          estado_vencimiento?: never
          existencia_actual?: number | null
          fecha_ultimo_service?: string | null
          fecha_vencimiento?: string | null
          frecuencia_service?: string | null
          id?: string | null
          n_lote?: string | null
          observacion?: string | null
          precio_alquiler_mensual?: number | null
          proveedor?: string | null
          se_factura_aparte?: boolean | null
          stock_maximo?: number | null
          stock_minimo?: number | null
          supplier_id?: string | null
          tipo?: Database["public"]["Enums"]["product_type"] | null
          vida_util_estimada?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      v_treatment_authorization_status: {
        Row: {
          autorizado_por: string | null
          cantidad_autorizada: number | null
          created_at: string | null
          especialidad: Database["public"]["Enums"]["specialty"] | null
          estado_semaforo:
            | Database["public"]["Enums"]["authorization_status"]
            | null
          id: number | null
          patient_id: string | null
          periodo_desde: string | null
          periodo_hasta: string | null
          practica: string | null
        }
        Insert: {
          autorizado_por?: string | null
          cantidad_autorizada?: number | null
          created_at?: string | null
          especialidad?: Database["public"]["Enums"]["specialty"] | null
          estado_semaforo?: never
          id?: number | null
          patient_id?: string | null
          periodo_desde?: string | null
          periodo_hasta?: string | null
          practica?: string | null
        }
        Update: {
          autorizado_por?: string | null
          cantidad_autorizada?: number | null
          created_at?: string | null
          especialidad?: Database["public"]["Enums"]["specialty"] | null
          estado_semaforo?: never
          id?: number | null
          patient_id?: string | null
          periodo_desde?: string | null
          periodo_hasta?: string | null
          practica?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "treatment_authorizations_autorizado_por_fkey"
            columns: ["autorizado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_authorizations_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_authorizations_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_control_frecuencia_diaria"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "treatment_authorizations_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_control_frecuencia_semanal"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "treatment_authorizations_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_prevalidacion_controles"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "treatment_authorizations_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_prevalidacion_facturacion"
            referencedColumns: ["patient_id"]
          },
        ]
      }
      v_visit_evolution_discrepancies: {
        Row: {
          especialidad: Database["public"]["Enums"]["specialty"] | null
          estado: Database["public"]["Enums"]["visit_status"] | null
          evolution_id: string | null
          fecha_programada: string | null
          patient_id: string | null
          profesional_id: string | null
          visit_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visits_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_control_frecuencia_diaria"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "visits_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_control_frecuencia_semanal"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "visits_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_prevalidacion_controles"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "visits_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_prevalidacion_facturacion"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "visits_profesional_id_fkey"
            columns: ["profesional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      admin_set_active: {
        Args: { p_active: boolean; p_id: string }
        Returns: undefined
      }
      admin_set_role: {
        Args: { p_id: string; p_role: Database["public"]["Enums"]["app_role"] }
        Returns: undefined
      }
      admin_update_legajo: {
        Args: {
          p_dni: string
          p_email_contacto: string
          p_especialidad: Database["public"]["Enums"]["specialty"]
          p_fecha_baja: string
          p_fecha_ingreso: string
          p_full_name: string
          p_id: string
          p_matricula: string
          p_telefono: string
        }
        Returns: undefined
      }
      fn__family_check: {
        Args: { p_pin: string; p_token: string }
        Returns: Record<string, unknown>
      }
      fn_arrival_confirm: { Args: { p_token: string }; Returns: Json }
      fn_arrival_info: { Args: { p_token: string }; Returns: Json }
      fn_arrival_link_create: { Args: { p_patient: string }; Returns: Json }
      fn_buscar_pacientes_similares: {
        Args: { p_dni?: string; p_nombre: string; p_telefono?: string }
        Returns: {
          dni: string
          estado: string
          id: string
          motivo: string
          nombre_completo: string
          nro_historia_clinica: number
          puntaje: number
        }[]
      }
      fn_digitos: { Args: { t: string }; Returns: string }
      fn_family_access_create: { Args: { p_patient: string }; Returns: Json }
      fn_family_access_list: { Args: { p_patient: string }; Returns: Json }
      fn_family_access_revoke: {
        Args: { p_access: string }
        Returns: undefined
      }
      fn_family_confirm_visit: {
        Args: {
          p_nombre: string
          p_pin: string
          p_token: string
          p_visit: string
        }
        Returns: Json
      }
      fn_family_portal_view: {
        Args: { p_pin: string; p_token: string }
        Returns: Json
      }
      fn_norm_texto: { Args: { t: string }; Returns: string }
      fn_notificar: {
        Args: {
          p_entidad?: string
          p_entidad_id?: string
          p_extra_users?: string[]
          p_href?: string
          p_tipo: string
          p_vars?: Json
        }
        Returns: number
      }
      get_current_app_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      touch_last_login: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role:
        | "deposito"
        | "administracion"
        | "transporte"
        | "direccion"
        | "coordinador_internacion"
        | "profesional_asistencial"
        | "medico_coordinador"
      asset_movement_type:
        | "entrega_domicilio"
        | "retiro_domicilio"
        | "llegada_deposito"
        | "domicilio_a_domicilio"
        | "mantenimiento"
        | "baja"
      asset_status: "disponible" | "asignado" | "mantenimiento" | "baja"
      authorization_status: "vigente" | "por_vencer" | "vencida"
      billing_period_status:
        | "abierto"
        | "en_revision"
        | "cerrado"
        | "facturado"
        | "cobrada"
        | "debitada"
        | "en_gestion"
      debit_status: "pendiente" | "en_gestion" | "resuelto" | "perdido"
      discharge_reason:
        | "alta"
        | "fallecimiento"
        | "fin_internacion"
        | "alta_medica"
        | "traslado_otro_domicilio"
        | "traslado_otra_institucion"
        | "internacion_otro"
      discharge_status: "pendiente_retiro" | "retiro_informado" | "cerrado"
      iva_category:
        | "21%"
        | "10.5%"
        | "27%"
        | "5%"
        | "2.5%"
        | "Exento"
        | "No Gravado"
      order_delivery_channel: "domicilio" | "retiro_local"
      order_priority: "normal" | "urgente"
      order_status:
        | "borrador"
        | "autorizado"
        | "preparado"
        | "despachado"
        | "entregado"
        | "cancelado"
      ownership_type: "propio" | "alquilado"
      patient_status: "admitido_pendiente_llegada" | "activo" | "dado_de_baja"
      product_type: "descartable" | "equipo" | "alimento"
      purchase_order_status:
        | "borrador"
        | "enviada"
        | "confirmada"
        | "recibida"
        | "cancelada"
      quote_request_status: "borrador" | "enviada" | "respondida" | "cerrada"
      replenishment_frequency:
        | "mensualizado"
        | "semanal"
        | "quincenal"
        | "a_demanda"
      specialty:
        | "enfermeria"
        | "medicina"
        | "kinesiologia"
        | "fonoaudiologia"
        | "nutricion"
        | "trabajo_social"
        | "otra"
        | "psicologia"
      stock_level_status: "critico" | "bajo" | "normal"
      stock_movement_type: "ingreso_compra" | "egreso_entrega" | "ajuste"
      visit_status:
        | "programada"
        | "confirmada"
        | "realizada"
        | "no_realizada"
        | "cancelada"
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
      app_role: [
        "deposito",
        "administracion",
        "transporte",
        "direccion",
        "coordinador_internacion",
        "profesional_asistencial",
        "medico_coordinador",
      ],
      asset_movement_type: [
        "entrega_domicilio",
        "retiro_domicilio",
        "llegada_deposito",
        "domicilio_a_domicilio",
        "mantenimiento",
        "baja",
      ],
      asset_status: ["disponible", "asignado", "mantenimiento", "baja"],
      authorization_status: ["vigente", "por_vencer", "vencida"],
      billing_period_status: [
        "abierto",
        "en_revision",
        "cerrado",
        "facturado",
        "cobrada",
        "debitada",
        "en_gestion",
      ],
      debit_status: ["pendiente", "en_gestion", "resuelto", "perdido"],
      discharge_reason: [
        "alta",
        "fallecimiento",
        "fin_internacion",
        "alta_medica",
        "traslado_otro_domicilio",
        "traslado_otra_institucion",
        "internacion_otro",
      ],
      discharge_status: ["pendiente_retiro", "retiro_informado", "cerrado"],
      iva_category: [
        "21%",
        "10.5%",
        "27%",
        "5%",
        "2.5%",
        "Exento",
        "No Gravado",
      ],
      order_delivery_channel: ["domicilio", "retiro_local"],
      order_priority: ["normal", "urgente"],
      order_status: [
        "borrador",
        "autorizado",
        "preparado",
        "despachado",
        "entregado",
        "cancelado",
      ],
      ownership_type: ["propio", "alquilado"],
      patient_status: ["admitido_pendiente_llegada", "activo", "dado_de_baja"],
      product_type: ["descartable", "equipo", "alimento"],
      purchase_order_status: [
        "borrador",
        "enviada",
        "confirmada",
        "recibida",
        "cancelada",
      ],
      quote_request_status: ["borrador", "enviada", "respondida", "cerrada"],
      replenishment_frequency: [
        "mensualizado",
        "semanal",
        "quincenal",
        "a_demanda",
      ],
      specialty: [
        "enfermeria",
        "medicina",
        "kinesiologia",
        "fonoaudiologia",
        "nutricion",
        "trabajo_social",
        "otra",
        "psicologia",
      ],
      stock_level_status: ["critico", "bajo", "normal"],
      stock_movement_type: ["ingreso_compra", "egreso_entrega", "ajuste"],
      visit_status: [
        "programada",
        "confirmada",
        "realizada",
        "no_realizada",
        "cancelada",
      ],
    },
  },
} as const
