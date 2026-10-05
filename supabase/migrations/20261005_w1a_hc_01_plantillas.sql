-- C2 · Plantillas reales por disciplina (R21-R26, R29, R37-R38, R46).
-- Solo cambia el contenido de `campos` (jsonb) de las 3 plantillas existentes
-- e inserta las de nutrición, psicología y fonoaudiología.
-- Atributos de cada campo: label, tipo (Texto | Texto largo | Número | Sí/No | Selección | Fecha...),
-- obligatorio, seccion (agrupa en el formulario), opciones (Selección), clave (nombre estable
-- en `respuestas`), ayuda, paso (Número) y narrativa (se omite en la impresión «OS»).
set lock_timeout = '5s';

update public.discipline_form_templates set
  titulo = 'Evolución de Enfermería',
  campos = $json$[
    {"label":"P/A","clave":"pa","tipo":"Texto","obligatorio":true,"seccion":"Signos vitales","ayuda":"Presión arterial. Ejemplo: 120/80"},
    {"label":"FC","clave":"fc","tipo":"Número","obligatorio":true,"seccion":"Signos vitales","ayuda":"Frecuencia cardíaca (latidos por minuto)"},
    {"label":"FR","clave":"fr","tipo":"Número","obligatorio":true,"seccion":"Signos vitales","ayuda":"Frecuencia respiratoria (respiraciones por minuto)"},
    {"label":"AX","clave":"ax","tipo":"Número","obligatorio":true,"seccion":"Signos vitales","paso":"0.1","ayuda":"Temperatura axilar en °C"},
    {"label":"Diuresis","clave":"diuresis","tipo":"Sí/No","obligatorio":true,"seccion":"Signos vitales"},
    {"label":"Catarsis","clave":"catarsis","tipo":"Sí/No","obligatorio":true,"seccion":"Signos vitales"},
    {"label":"Prestación realizada","clave":"prestacion_realizada","tipo":"Selección","obligatorio":false,"seccion":"Observaciones","opciones":["CSV (control de signos vitales)","Curación de escaras","Otra prestación"]},
    {"label":"Evolución (breve)","clave":"evolucion_breve","tipo":"Texto","obligatorio":true,"seccion":"Observaciones"},
    {"label":"Observaciones (narrativa extendida)","clave":"observaciones","tipo":"Texto largo","obligatorio":false,"seccion":"Observaciones","narrativa":true}
  ]$json$::jsonb
where especialidad = 'enfermeria';

update public.discipline_form_templates set
  campos = $json$[
    {"label":"Motivo de la consulta","clave":"motivo_de_la_consulta","tipo":"Texto","obligatorio":true},
    {"label":"Examen físico","clave":"examen_fisico","tipo":"Texto largo","obligatorio":true},
    {"label":"Evolución e indicación médica","clave":"evolucion_indicacion_medica","tipo":"Texto largo","obligatorio":true,"ayuda":"Texto libre: evolución del cuadro e indicaciones. La medicación se carga más abajo, ordenada."}
  ]$json$::jsonb
where especialidad = 'medicina';

update public.discipline_form_templates set
  campos = $json$[
    {"label":"Tratamiento realizado","clave":"tratamiento_realizado","tipo":"Selección","obligatorio":true,"opciones":["KTM (kinesioterapia motora)","Kinesioterapia respiratoria","Otro tratamiento"]},
    {"label":"Detalle del tratamiento","clave":"detalle_tratamiento","tipo":"Texto largo","obligatorio":false},
    {"label":"Rango articular / tolerancia al esfuerzo","clave":"rango_articular","tipo":"Texto","obligatorio":false},
    {"label":"Evolución","clave":"evolucion","tipo":"Texto","obligatorio":true,"ayuda":"Ejemplo: estable, movimiento activo"}
  ]$json$::jsonb
where especialidad = 'kinesiologia';

insert into public.discipline_form_templates (titulo, especialidad, campos, activo)
select 'Evolución de Nutrición', 'nutricion',
  $json$[
    {"label":"Evolución","clave":"evolucion","tipo":"Texto largo","obligatorio":true},
    {"label":"Indicaciones y plan","clave":"indicaciones","tipo":"Texto largo","obligatorio":false}
  ]$json$::jsonb, true
where not exists (select 1 from public.discipline_form_templates where especialidad = 'nutricion');

insert into public.discipline_form_templates (titulo, especialidad, campos, activo)
select 'Evolución de Psicología', 'psicologia',
  $json$[
    {"label":"Evolución","clave":"evolucion","tipo":"Texto largo","obligatorio":true},
    {"label":"Indicaciones y plan","clave":"indicaciones","tipo":"Texto largo","obligatorio":false}
  ]$json$::jsonb, true
where not exists (select 1 from public.discipline_form_templates where especialidad = 'psicologia');

insert into public.discipline_form_templates (titulo, especialidad, campos, activo)
select 'Evolución de Fonoaudiología', 'fonoaudiologia',
  $json$[
    {"label":"Evolución","clave":"evolucion","tipo":"Texto largo","obligatorio":true},
    {"label":"Indicaciones y plan","clave":"indicaciones","tipo":"Texto largo","obligatorio":false}
  ]$json$::jsonb, true
where not exists (select 1 from public.discipline_form_templates where especialidad = 'fonoaudiologia');
