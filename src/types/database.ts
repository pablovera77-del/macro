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
      billing_debits: {
        Row: {
          billing_period_id: string
          created_at: string
          estado: Database["public"]["Enums"]["debit_status"]
          gestionado_por: string | null
          id: number
          monto: number
          motivo: string
          patient_id: string | null
        }
        Insert: {
          billing_period_id: string
          created_at?: string
          estado?: Database["public"]["Enums"]["debit_status"]
          gestionado_por?: string | null
          id?: never
          monto: number
          motivo: string
          patient_id?: string | null
        }
        Update: {
          billing_period_id?: string
          created_at?: string
          estado?: Database["public"]["Enums"]["debit_status"]
          gestionado_por?: string | null
          id?: never
          monto?: number
          motivo?: string
          patient_id?: string | null
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
            referencedRelation: "v_prevalidacion_facturacion"
            referencedColumns: ["patient_id"]
          },
        ]
      }
      equipment_asset_photos: {
        Row: {
          asset_id: string
          created_at: string
          id: number
          momento: string
          url: string
        }
        Insert: {
          asset_id: string
          created_at?: string
          id?: never
          momento: string
          url: string
        }
        Update: {
          asset_id?: string
          created_at?: string
          id?: never
          momento?: string
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
      evolutions: {
        Row: {
          conformidad_familiar: boolean | null
          conformidad_familiar_at: string | null
          created_at: string
          especialidad: Database["public"]["Enums"]["specialty"]
          firma_profesional_at: string | null
          id: string
          patient_id: string
          profesional_id: string
          respuestas: Json
          template_id: string | null
          upp_escala_nova5: Json | null
          visit_id: string | null
        }
        Insert: {
          conformidad_familiar?: boolean | null
          conformidad_familiar_at?: string | null
          created_at?: string
          especialidad: Database["public"]["Enums"]["specialty"]
          firma_profesional_at?: string | null
          id?: string
          patient_id: string
          profesional_id: string
          respuestas?: Json
          template_id?: string | null
          upp_escala_nova5?: Json | null
          visit_id?: string | null
        }
        Update: {
          conformidad_familiar?: boolean | null
          conformidad_familiar_at?: string | null
          created_at?: string
          especialidad?: Database["public"]["Enums"]["specialty"]
          firma_profesional_at?: string | null
          id?: string
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
          created_at: string
          cuit: string | null
          dias_para_facturar: number
          id: string
          nombre: string
          responsable_id: string | null
          valor_modulo: number | null
        }
        Insert: {
          activa?: boolean
          created_at?: string
          cuit?: string | null
          dias_para_facturar?: number
          id?: string
          nombre: string
          responsable_id?: string | null
          valor_modulo?: number | null
        }
        Update: {
          activa?: boolean
          created_at?: string
          cuit?: string | null
          dias_para_facturar?: number
          id?: string
          nombre?: string
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
          equipment_asset_id: string | null
          id: number
          order_id: string
          product_id: string
        }
        Insert: {
          cantidad?: number
          equipment_asset_id?: string | null
          id?: never
          order_id: string
          product_id: string
        }
        Update: {
          cantidad?: number
          equipment_asset_id?: string | null
          id?: never
          order_id?: string
          product_id?: string
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
        ]
      }
      orders: {
        Row: {
          autorizacion_automatica: boolean
          autorizado_por: string | null
          canal_entrega: Database["public"]["Enums"]["order_delivery_channel"]
          creado_por: string
          created_at: string
          estado: Database["public"]["Enums"]["order_status"]
          fecha_autorizacion: string | null
          id: string
          motivo_rechazo: string | null
          patient_id: string
          prioridad: Database["public"]["Enums"]["order_priority"]
          rechazado_por: string | null
        }
        Insert: {
          autorizacion_automatica?: boolean
          autorizado_por?: string | null
          canal_entrega?: Database["public"]["Enums"]["order_delivery_channel"]
          creado_por: string
          created_at?: string
          estado?: Database["public"]["Enums"]["order_status"]
          fecha_autorizacion?: string | null
          id?: string
          motivo_rechazo?: string | null
          patient_id: string
          prioridad?: Database["public"]["Enums"]["order_priority"]
          rechazado_por?: string | null
        }
        Update: {
          autorizacion_automatica?: boolean
          autorizado_por?: string | null
          canal_entrega?: Database["public"]["Enums"]["order_delivery_channel"]
          creado_por?: string
          created_at?: string
          estado?: Database["public"]["Enums"]["order_status"]
          fecha_autorizacion?: string | null
          id?: string
          motivo_rechazo?: string | null
          patient_id?: string
          prioridad?: Database["public"]["Enums"]["order_priority"]
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
            referencedRelation: "v_prevalidacion_facturacion"
            referencedColumns: ["patient_id"]
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
      patients: {
        Row: {
          contacto_familiar_nombre: string | null
          contacto_familiar_telefono: string | null
          coordinador_id: string | null
          created_at: string
          diagnostico_principal: string | null
          dni: string
          domicilio: string
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
          llegada_confirmada_at: string | null
          medico_derivante: string | null
          motivo_egreso: Database["public"]["Enums"]["discharge_reason"] | null
          nombre_completo: string
          numero_afiliado: string | null
          obra_social: string | null
          obra_social_id: string | null
          telefono_contacto: string | null
        }
        Insert: {
          contacto_familiar_nombre?: string | null
          contacto_familiar_telefono?: string | null
          coordinador_id?: string | null
          created_at?: string
          diagnostico_principal?: string | null
          dni: string
          domicilio: string
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
          llegada_confirmada_at?: string | null
          medico_derivante?: string | null
          motivo_egreso?: Database["public"]["Enums"]["discharge_reason"] | null
          nombre_completo: string
          numero_afiliado?: string | null
          obra_social?: string | null
          obra_social_id?: string | null
          telefono_contacto?: string | null
        }
        Update: {
          contacto_familiar_nombre?: string | null
          contacto_familiar_telefono?: string | null
          coordinador_id?: string | null
          created_at?: string
          diagnostico_principal?: string | null
          dni?: string
          domicilio?: string
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
          llegada_confirmada_at?: string | null
          medico_derivante?: string | null
          motivo_egreso?: Database["public"]["Enums"]["discharge_reason"] | null
          nombre_completo?: string
          numero_afiliado?: string | null
          obra_social?: string | null
          obra_social_id?: string | null
          telefono_contacto?: string | null
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
          full_name: string
          id: string
          last_login_at: string | null
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          active?: boolean
          created_at?: string
          full_name: string
          id: string
          last_login_at?: string | null
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          active?: boolean
          created_at?: string
          full_name?: string
          id?: string
          last_login_at?: string | null
          role?: Database["public"]["Enums"]["app_role"]
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
          fecha_despacho: string | null
          fecha_entrega: string | null
          firma_familiar_url: string | null
          firmado_at: string | null
          id: string
          notificacion_canal: string | null
          notificacion_enviada_at: string | null
          order_id: string
          transportista_id: string | null
        }
        Insert: {
          fecha_despacho?: string | null
          fecha_entrega?: string | null
          firma_familiar_url?: string | null
          firmado_at?: string | null
          id?: string
          notificacion_canal?: string | null
          notificacion_enviada_at?: string | null
          order_id: string
          transportista_id?: string | null
        }
        Update: {
          fecha_despacho?: string | null
          fecha_entrega?: string | null
          firma_familiar_url?: string | null
          firmado_at?: string | null
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
          asset_id: string | null
          cantidad: number | null
          discharge_alert_id: string
          foto_url: string | null
          id: number
          llego_deposito_at: string | null
          llego_deposito_confirmado_por: string | null
          product_id: string | null
          retirado_at: string | null
          retirado_por: string | null
        }
        Insert: {
          asset_id?: string | null
          cantidad?: number | null
          discharge_alert_id: string
          foto_url?: string | null
          id?: never
          llego_deposito_at?: string | null
          llego_deposito_confirmado_por?: string | null
          product_id?: string | null
          retirado_at?: string | null
          retirado_por?: string | null
        }
        Update: {
          asset_id?: string | null
          cantidad?: number | null
          discharge_alert_id?: string
          foto_url?: string | null
          id?: never
          llego_deposito_at?: string | null
          llego_deposito_confirmado_por?: string | null
          product_id?: string | null
          retirado_at?: string | null
          retirado_por?: string | null
        }
        Relationships: [
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
            foreignKeyName: "retrieval_checklist_retirado_por_fkey"
            columns: ["retirado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      treatment_authorizations: {
        Row: {
          autorizado_por: string | null
          cantidad_autorizada: number
          created_at: string
          especialidad: Database["public"]["Enums"]["specialty"]
          id: number
          patient_id: string
          periodo_desde: string
          periodo_hasta: string
          practica: string
        }
        Insert: {
          autorizado_por?: string | null
          cantidad_autorizada: number
          created_at?: string
          especialidad: Database["public"]["Enums"]["specialty"]
          id?: never
          patient_id: string
          periodo_desde?: string
          periodo_hasta: string
          practica: string
        }
        Update: {
          autorizado_por?: string | null
          cantidad_autorizada?: number
          created_at?: string
          especialidad?: Database["public"]["Enums"]["specialty"]
          id?: never
          patient_id?: string
          periodo_desde?: string
          periodo_hasta?: string
          practica?: string
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
            referencedRelation: "v_prevalidacion_facturacion"
            referencedColumns: ["patient_id"]
          },
        ]
      }
      visits: {
        Row: {
          creado_por: string | null
          created_at: string
          especialidad: Database["public"]["Enums"]["specialty"]
          estado: Database["public"]["Enums"]["visit_status"]
          fecha_programada: string
          fecha_realizada: string | null
          id: string
          observacion_agenda: string | null
          patient_id: string
          profesional_id: string
        }
        Insert: {
          creado_por?: string | null
          created_at?: string
          especialidad: Database["public"]["Enums"]["specialty"]
          estado?: Database["public"]["Enums"]["visit_status"]
          fecha_programada: string
          fecha_realizada?: string | null
          id?: string
          observacion_agenda?: string | null
          patient_id: string
          profesional_id: string
        }
        Update: {
          creado_por?: string | null
          created_at?: string
          especialidad?: Database["public"]["Enums"]["specialty"]
          estado?: Database["public"]["Enums"]["visit_status"]
          fecha_programada?: string
          fecha_realizada?: string | null
          id?: string
          observacion_agenda?: string | null
          patient_id?: string
          profesional_id?: string
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
      v_prevalidacion_facturacion: {
        Row: {
          billing_period_id: string | null
          cantidad_autorizada: number | null
          especialidad: Database["public"]["Enums"]["specialty"] | null
          estado_prevalidacion: string | null
          evoluciones_cargadas_mes: number | null
          evoluciones_esperadas_mes: number | null
          nombre_completo: string | null
          obra_social_id: string | null
          overlap_desde: string | null
          overlap_hasta: string | null
          patient_id: string | null
          periodo: string | null
          periodo_desde: string | null
          periodo_hasta: string | null
          practica: string | null
          treatment_authorization_id: number | null
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
      v_prevalidacion_resumen: {
        Row: {
          amarillos: number | null
          billing_period_id: string | null
          bloqueado: boolean | null
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
      get_current_app_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
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
      discharge_reason: "alta" | "fallecimiento" | "fin_internacion"
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
      discharge_reason: ["alta", "fallecimiento", "fin_internacion"],
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
