-- =====================================================================================================================
-- VERIFICACIÓN DE SOLO LECTURA: compara la base real con lo que el código necesita. No modifica nada.
-- Ejecútala contra tu base (psql o el editor SQL de Supabase) y revisa las filas con resultado = 'FALTA'.
-- Existe porque "ESTRUCTURA Y RELACIONES - BD.docx" no documenta índices, triggers ni procedimientos, y no lista clientes.estado.
-- =====================================================================================================================

-- 1) Columnas que el código lee o escribe (entidades JPA y consultas JDBC).
with esperadas(tabla, columna) as (values
    ('clientes', 'id'), ('clientes', 'numero'), ('clientes', 'tipo_documento'), ('clientes', 'numero_documento'),
    ('clientes', 'nombre'), ('clientes', 'telefono'), ('clientes', 'correo'), ('clientes', 'dni_titular'),
    ('clientes', 'domicilio'), ('clientes', 'estado_sunat'), ('clientes', 'condicion_sunat'),
    ('clientes', 'representante_nombre'), ('clientes', 'representante_dni'), ('clientes', 'agencia_id'),
    ('clientes', 'creado_por'), ('clientes', 'creado_en'),
    ('clientes', 'estado'),   -- el código la usa (Cliente.estado, EstadoClienteRepositorio); el documento de BD no la lista
    ('prestamos', 'id'), ('prestamos', 'numero'), ('prestamos', 'cliente_id'), ('prestamos', 'agencia_id'),
    ('prestamos', 'asesor_id'), ('prestamos', 'moneda'), ('prestamos', 'capital'), ('prestamos', 'plazo_meses'),
    ('prestamos', 'tea'), ('prestamos', 'fecha_desembolso'), ('prestamos', 'estado'), ('prestamos', 'observaciones'),
    ('prestamos', 'creado_en'),
    ('cuotas', 'prestamo_id'), ('cuotas', 'numero'), ('cuotas', 'fecha_vencimiento'), ('cuotas', 'capital'),
    ('cuotas', 'interes'), ('cuotas', 'importe_cuota'), ('cuotas', 'saldo'), ('cuotas', 'estado'),
    ('contratos_prestamo', 'id'), ('contratos_prestamo', 'prestamo_id'), ('contratos_prestamo', 'version'),
    ('contratos_prestamo', 'plantilla_version'), ('contratos_prestamo', 'datos'), ('contratos_prestamo', 'huella_sha256'),
    ('contratos_prestamo', 'generado_por'), ('contratos_prestamo', 'generado_en')
)
select 'columna' as tipo, e.tabla || '.' || e.columna as elemento,
       case when c.column_name is null then 'FALTA' else 'ok' end as resultado
from esperadas e
left join information_schema.columns c
       on c.table_schema = 'public' and c.table_name = e.tabla and c.column_name = e.columna
order by resultado desc, elemento;

-- 2) Índices e integridad que usan la consolidación y el contrato.
select 'indice' as tipo, n.nombre as elemento,
       case when exists (select 1 from pg_indexes where schemaname = 'public' and indexname = n.nombre)
            then 'ok' else 'FALTA' end as resultado
from (values ('clientes_dni_titular_idx'), ('clientes_tipo_numero_documento_idx')) as n(nombre)
union all
select 'trigger', t.nombre,
       case when exists (select 1 from pg_trigger where tgname = t.nombre and not tgisinternal) then 'ok' else 'FALTA' end
from (values ('contratos_prestamo_inmutable_tg'), ('contratos_prestamo_sin_truncate_tg')) as t(nombre);

-- 3) Índices únicos existentes sobre clientes (el documento no los lista): informativo.
select indexname, indexdef from pg_indexes where schemaname = 'public' and tablename = 'clientes' order by indexname;

-- 4) Triggers y funciones del esquema public (el documento no los lista): informativo.
select tgrelid::regclass as tabla, tgname as trigger from pg_trigger where not tgisinternal order by 1, 2;
select routine_name, routine_type from information_schema.routines where routine_schema = 'public' order by 1;

-- 5) Datos que impedirían consolidar bien (informativo; no se corrigen automáticamente).
--    RUC 10 con dni_titular que no coincide con los 8 dígitos tras el prefijo 10 de su propio RUC.
select id, numero_documento as ruc, dni_titular
from public.clientes
where tipo_documento = 'RUC 10' and substr(numero_documento, 3, 8) <> dni_titular;
