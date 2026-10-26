-- =====================================================================================================================
-- Contratos de préstamo (instantánea inmutable) y consulta del grupo crediticio DNI <-> RUC 10.
--
--  * SOLO ADITIVA: crea una tabla, dos índices, una función y un trigger. No modifica ni borra datos existentes.
--  * Es seguro ejecutarla más de una vez.
--  * Ejecútala ANTES de desplegar el backend nuevo: el registro de préstamos guarda el contrato en la misma transacción.
--
-- Qué guarda contratos_prestamo:
--   datos          texto JSON con TODO lo que el contrato dice (partes, condiciones, cronograma, plantilla). Es la instantánea
--                  del momento del registro: el PDF se dibuja siempre desde aquí, nunca se recalcula.
--   huella_sha256  SHA-256 de `datos`. La propia BD comprueba que coincide (CHECK) y el trigger impide modificar o borrar.
--   version        1 para el contrato original. Un cambio autorizado futuro se guarda como version 2, 3...; la anterior se conserva.
--   plantilla_version  versión del texto del contrato usada (para saber con qué plantilla se redactó).
-- No se guarda el PDF como bytes: se reconstruye de forma determinista desde `datos` (ver README, sección Contrato).
-- =====================================================================================================================

-- Búsqueda del grupo crediticio (cliente DNI y sus RUC 10 por dni_titular). Índices no únicos: no pueden fallar por datos previos.
create index if not exists clientes_dni_titular_idx
    on public.clientes (dni_titular)
    where tipo_documento = 'RUC 10';

create index if not exists clientes_tipo_numero_documento_idx
    on public.clientes (tipo_documento, numero_documento);

create table if not exists public.contratos_prestamo (
    id                 uuid        primary key default gen_random_uuid(),
    prestamo_id        uuid        not null references public.prestamos (id) on update no action on delete restrict,
    version            integer     not null default 1,
    plantilla_version  text        not null,
    datos              text        not null,
    huella_sha256      text        not null,
    generado_por       uuid        not null references public.perfiles (id) on update no action on delete restrict,
    generado_en        timestamptz not null default now(),
    constraint contratos_prestamo_version_uq unique (prestamo_id, version),
    constraint contratos_prestamo_version_ck check (version >= 1),
    constraint contratos_prestamo_plantilla_ck check (length(btrim(plantilla_version)) > 0),
    constraint contratos_prestamo_json_ck check ((datos::jsonb) is not null),
    constraint contratos_prestamo_huella_ck check (huella_sha256 ~ '^[0-9a-f]{64}$'),
    constraint contratos_prestamo_huella_coincide_ck
        check (huella_sha256 = encode(sha256(convert_to(datos, 'UTF8')), 'hex'))
);

-- Contiene datos personales: sin políticas RLS, el acceso por la API pública de Supabase (anon/authenticated) queda denegado.
-- El backend se conecta con el rol propietario de la tabla (p. ej. postgres), que no queda sujeto a RLS.
alter table public.contratos_prestamo enable row level security;

-- Solo inserción: un contrato guardado no se modifica ni se borra.
create or replace function public.contratos_prestamo_solo_insercion() returns trigger
language plpgsql as $$
begin
    raise exception 'contratos_prestamo es de solo inserción: no se permite % sobre un contrato guardado.', tg_op
        using errcode = '23001'; -- restrict_violation
end;
$$;

drop trigger if exists contratos_prestamo_inmutable_tg on public.contratos_prestamo;
create trigger contratos_prestamo_inmutable_tg
    before update or delete on public.contratos_prestamo
    for each row execute function public.contratos_prestamo_solo_insercion();

drop trigger if exists contratos_prestamo_sin_truncate_tg on public.contratos_prestamo;
create trigger contratos_prestamo_sin_truncate_tg
    before truncate on public.contratos_prestamo
    for each statement execute function public.contratos_prestamo_solo_insercion();
