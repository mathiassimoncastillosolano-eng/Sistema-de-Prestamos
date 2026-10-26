-- Copia mínima de las tablas reales (Supabase "Sistema Prestamos") para la prueba de concurrencia.
-- Solo crea lo que falta: nunca borra ni modifica datos.
create table if not exists public.ubicaciones (
    id uuid primary key default gen_random_uuid(),
    departamento text not null, provincia text not null, distrito text not null, direccion text,
    creado_en timestamptz not null default now()
);
create table if not exists public.agencias (
    id uuid primary key default gen_random_uuid(),
    nombre text not null, ubicacion_id uuid not null references public.ubicaciones (id),
    activa boolean not null default true, creado_en timestamptz not null default now()
);
create table if not exists public.perfiles (
    id uuid primary key default gen_random_uuid(),
    nombres text not null, apellidos text not null, correo text not null, rol text not null,
    agencia_id uuid references public.agencias (id), activo boolean not null default true,
    creado_en timestamptz not null default now(), clave_hash text not null
);
create table if not exists public.clientes (
    id uuid primary key default gen_random_uuid(),
    numero bigint generated always as identity,
    tipo_documento text not null, numero_documento text not null, nombre text not null, telefono text,
    dni_titular text, domicilio text, representante_nombre text, representante_dni text,
    agencia_id uuid not null references public.agencias (id), creado_por uuid not null references public.perfiles (id),
    creado_en timestamptz not null default now(), estado_sunat text, condicion_sunat text, correo text
);
create table if not exists public.prestamos (
    id uuid primary key default gen_random_uuid(),
    numero bigint generated always as identity (start with 1001),
    cliente_id uuid not null references public.clientes (id), agencia_id uuid not null references public.agencias (id),
    asesor_id uuid not null references public.perfiles (id), moneda text not null default 'PEN',
    capital numeric(12, 2) not null, plazo_meses integer not null, tea numeric(7, 6) not null,
    fecha_desembolso date not null, estado text not null default 'Vigente', observaciones text,
    creado_en timestamptz not null default now()
);
create table if not exists public.cuotas (
    prestamo_id uuid not null references public.prestamos (id), numero integer not null,
    fecha_vencimiento date not null, capital numeric(12, 2) not null, interes numeric(12, 2) not null,
    importe_cuota numeric(12, 2) not null, saldo numeric(12, 2) not null,
    estado varchar(20) not null default 'PENDIENTE',
    primary key (prestamo_id, numero)
);
-- clientes.estado (ACTIVO | MOROSO | EXTRAJUDICIAL): el registro de préstamos lo recalcula y lo guarda.
alter table public.clientes add column if not exists estado text not null default 'ACTIVO';

-- Contratos del préstamo (la tabla real además es de solo inserción con triggers; aquí basta la estructura que usa el registro).
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
    constraint contratos_prestamo_huella_coincide_ck check (huella_sha256 = encode(sha256(convert_to(datos, 'UTF8')), 'hex'))
);
