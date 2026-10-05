-- Aplicado el 04/10 (RLS de firmas, documentos legales y facturas de proveedores). Copia de documentación.
-- 1) Firmas de consentimientos --------------------------------------------
alter table public.patient_document_signatures enable row level security;

-- Ven las firmas quienes trabajan con el legajo (Administración, Coordinación,
-- Profesionales y Dirección). Depósito y Transporte no.
create policy select_signatures on public.patient_document_signatures for select
  using (public.get_current_app_role() in
    ('administracion','coordinador_internacion','profesional_asistencial','direccion'));

-- Solo Administración registra firmas (igual que signLegalDocumentAction).
create policy insert_signatures on public.patient_document_signatures for insert
  with check (public.get_current_app_role() = 'administracion');
-- Sin UPDATE ni DELETE: una firma registrada no se edita ni se borra.

-- 2) Catálogo de documentos legales ---------------------------------------
alter table public.legal_documents enable row level security;
create policy select_legal_docs on public.legal_documents for select
  using (auth.uid() is not null);
-- Sin escritura desde la app: el catálogo se cambia por migración.

-- 3) Facturas de proveedores (Compras) ------------------------------------
alter table public.purchase_order_invoices enable row level security;
create policy select_po_invoices on public.purchase_order_invoices for select
  using (public.get_current_app_role() in ('deposito','administracion'));
create policy insert_po_invoices on public.purchase_order_invoices for insert
  with check (public.get_current_app_role() in ('deposito','administracion'));

alter table public.purchase_order_invoice_items enable row level security;
create policy select_po_invoice_items on public.purchase_order_invoice_items for select
  using (public.get_current_app_role() in ('deposito','administracion'));
create policy insert_po_invoice_items on public.purchase_order_invoice_items for insert
  with check (public.get_current_app_role() in ('deposito','administracion'));

-- 4) Sin acceso para visitantes no identificados --------------------------
revoke all on public.patient_document_signatures from anon;
revoke all on public.legal_documents from anon;
revoke all on public.purchase_order_invoices from anon;
revoke all on public.purchase_order_invoice_items from anon;

revoke execute on function public.fn_audit_log_family() from public, anon, authenticated;
revoke execute on function public.fn_audit_log_clinical() from public, anon, authenticated;
