-- Etapa 3 (aditiva, no modifica tablas existentes):
-- plan de tratamiento (DF-C3 §4.3), mensajería por paciente, medicación vigente (paso 4),
-- checklist de información (paso 5, R PFS 01), documentación por obra social (paso 6),
-- y triggers de auditoría sobre las tablas clave (DF-C1 §4.1).

-- Psicología figura en DF-C3 §4.3 y no estaba en el enum de disciplinas.
alter type public.specialty add value if not exists 'psicologia';
