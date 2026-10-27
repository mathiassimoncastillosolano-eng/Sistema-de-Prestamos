-- =====================================================================================================================
-- Caja del asesor y reposiciones de efectivo (solicitud -> aprobación con Hermes -> envío -> recepción -> conciliación).
--
--  * SOLO ADITIVA: crea 7 tablas, funciones, triggers e índices nuevos. NO modifica ni borra ninguna tabla, columna ni dato
--    existente (perfiles, agencias, prestamos, cuotas, clientes, contratos_prestamo quedan intactas).
--  * Es seguro ejecutarla más de una vez (create ... if not exists / create or replace / bloques DO guardados).
--  * Ejecútala ANTES de desplegar el backend nuevo: registrar un préstamo ahora descuenta el desembolso de la caja del
--    asesor en la misma transacción.
--  * NO se ejecuta sola contra producción: aplícala tú (psql o editor SQL de Supabase) cuando lo decidas.
--
-- Garantías que impone la propia base de datos (independientes del código Java):
--   * El saldo de una caja SOLO cambia insertando un movimiento en caja_movimientos (trigger). Un UPDATE directo de
--     cajas.saldo se rechaza. Así no puede existir "saldo actualizado sin movimiento".
--   * caja_movimientos, caja_auditoria y hermes_verificaciones.huella son de solo inserción (no UPDATE/DELETE/TRUNCATE).
--   * 0 <= saldo <= limite (S/ 50,000) en todo momento (CHECK), también con operaciones concurrentes.
--   * Un desembolso (prestamo_id) y una recepción (recepcion_id) solo pueden generar UN movimiento (índices únicos):
--     no hay doble contabilización.
--   * Solo UNA reposición "abierta" por caja (índice único parcial): no hay solicitudes duplicadas.
--   * Un código Hermes (su huella HMAC, nunca el código) solo puede aceptarse una vez.
-- =====================================================================================================================

-- ------------------------------------------------------------------------------------------------ cajas
-- Una caja por asesor (el saldo se arrastra de una jornada a otra). Se abre sola con S/ 50,000 la primera vez que el
-- asesor la necesita; la apertura queda como primer movimiento del libro.
create table if not exists public.cajas (
    id              uuid          primary key default gen_random_uuid(),
    asesor_id       uuid          not null unique references public.perfiles (id) on update no action on delete restrict,
    agencia_id      uuid          not null references public.agencias (id) on update no action on delete restrict,
    limite          numeric(14,2) not null default 50000.00,
    saldo_inicial   numeric(14,2) not null default 50000.00,
    saldo           numeric(14,2) not null default 0.00,
    estado          text          not null default 'ABIERTA',
    abierta_en      timestamptz   not null default now(),
    abierta_por     uuid          not null references public.perfiles (id) on update no action on delete restrict,
    actualizado_en  timestamptz   not null default now(),
    constraint cajas_limite_ck        check (limite > 0),
    constraint cajas_saldo_inicial_ck check (saldo_inicial >= 0 and saldo_inicial <= limite),
    constraint cajas_saldo_ck         check (saldo >= 0 and saldo <= limite),
    constraint cajas_estado_ck        check (estado in ('ABIERTA', 'CERRADA'))
);
create index if not exists cajas_agencia_idx on public.cajas (agencia_id);

-- ------------------------------------------------------------------------------------------------ reposiciones
create table if not exists public.reposiciones (
    id                       uuid          primary key default gen_random_uuid(),
    numero                   bigint        generated always as identity (start with 1001),
    caja_id                  uuid          not null references public.cajas (id) on update no action on delete restrict,
    asesor_id                uuid          not null references public.perfiles (id) on update no action on delete restrict,
    agencia_id               uuid          not null references public.agencias (id) on update no action on delete restrict,
    -- 1) solicitud
    monto_solicitado         numeric(14,2) not null,
    motivo                   text          not null,
    comentarios              text          not null,
    saldo_al_solicitar       numeric(14,2) not null,
    capacidad_al_solicitar   numeric(14,2) not null,
    clave_idempotencia       text          not null,
    estado                   text          not null default 'PENDIENTE_APROBACION',
    -- 2) autorización (gerencia + Hermes)
    monto_autorizado         numeric(14,2),
    decidido_por             uuid          references public.perfiles (id) on update no action on delete restrict,
    decidido_en              timestamptz,
    justificacion_decision   text,
    hermes_verificacion_id   uuid,
    -- 3) envío
    monto_enviado            numeric(14,2),
    enviado_por              uuid          references public.perfiles (id) on update no action on delete restrict,
    enviado_en               timestamptz,
    referencia_envio         text,
    -- 4) recepción (el detalle de cada ingreso está en reposicion_recepciones)
    total_recibido           numeric(14,2) not null default 0.00,
    cierre_remanente_importe numeric(14,2) not null default 0.00,
    cierre_remanente_por     uuid          references public.perfiles (id) on update no action on delete restrict,
    cierre_remanente_en      timestamptz,
    cierre_remanente_motivo  text,
    -- 5) conciliación
    conciliado_por           uuid          references public.perfiles (id) on update no action on delete restrict,
    conciliado_en            timestamptz,
    conciliacion_nota        text,
    -- control
    creado_por               uuid          not null references public.perfiles (id) on update no action on delete restrict,
    creado_en                timestamptz   not null default now(),
    actualizado_en           timestamptz   not null default now(),
    version                  integer       not null default 0,
    constraint reposiciones_clave_uq        unique (asesor_id, clave_idempotencia),
    constraint reposiciones_monto_sol_ck    check (monto_solicitado > 0),
    constraint reposiciones_motivo_ck       check (motivo in ('DESEMBOLSOS_PROGRAMADOS', 'ALTA_DEMANDA',
                                                              'RECUPERACION_CAPACIDAD', 'OTRO')),
    constraint reposiciones_comentarios_ck  check (length(btrim(comentarios)) >= 10 and length(comentarios) <= 1000),
    constraint reposiciones_saldo_sol_ck    check (saldo_al_solicitar >= 0 and capacidad_al_solicitar >= 0),
    constraint reposiciones_estado_ck       check (estado in ('PENDIENTE_APROBACION', 'OBSERVADA', 'APROBADA', 'EN_TRANSITO',
                                                              'RECEPCION_PARCIAL', 'RECIBIDA', 'COMPLETADA',
                                                              'RECHAZADA', 'CANCELADA')),
    constraint reposiciones_autorizado_ck   check (monto_autorizado is null
                                                   or (monto_autorizado > 0 and monto_autorizado <= monto_solicitado)),
    constraint reposiciones_enviado_ck      check (monto_enviado is null
                                                   or (monto_enviado > 0 and monto_autorizado is not null
                                                       and monto_enviado <= monto_autorizado)),
    constraint reposiciones_recibido_ck     check (total_recibido >= 0 and cierre_remanente_importe >= 0
                                                   and total_recibido + cierre_remanente_importe
                                                       <= coalesce(monto_autorizado, 0)),
    -- Una reposición autorizada siempre tiene autorizador, fecha y verificación Hermes.
    constraint reposiciones_autorizada_ck   check (estado not in ('APROBADA', 'EN_TRANSITO', 'RECEPCION_PARCIAL',
                                                                  'RECIBIDA', 'COMPLETADA')
                                                   or (monto_autorizado is not null and decidido_por is not null
                                                       and decidido_en is not null
                                                       and hermes_verificacion_id is not null)),
    constraint reposiciones_rechazo_ck      check (estado <> 'RECHAZADA'
                                                   or (decidido_por is not null and justificacion_decision is not null
                                                       and length(btrim(justificacion_decision)) >= 10)),
    constraint reposiciones_completada_ck   check (estado <> 'COMPLETADA'
                                                   or (conciliado_por is not null and conciliado_en is not null))
);
create index if not exists reposiciones_estado_idx   on public.reposiciones (estado, creado_en desc);
create index if not exists reposiciones_asesor_idx   on public.reposiciones (asesor_id, creado_en desc);
create index if not exists reposiciones_agencia_idx  on public.reposiciones (agencia_id, creado_en desc);
create index if not exists reposiciones_caja_idx     on public.reposiciones (caja_id, creado_en desc);
-- Política de solicitudes simultáneas: UNA reposición abierta por caja. Hasta que se resuelva (recibida, rechazada,
-- cancelada o con el remanente cerrado) no se puede pedir otra; no hay duplicados accidentales ni sobreasignación.
create unique index if not exists reposiciones_una_abierta_uq
    on public.reposiciones (caja_id)
    where estado in ('PENDIENTE_APROBACION', 'OBSERVADA', 'APROBADA', 'EN_TRANSITO', 'RECEPCION_PARCIAL');

-- ------------------------------------------------------------------------------------------------ hermes_verificaciones
-- Cada intento de verificación de un código Hermes. NUNCA se guarda el código: solo su huella HMAC-SHA256 (con un secreto
-- del servidor) cuando el intento fue válido, para impedir que el mismo código se acepte dos veces.
create table if not exists public.hermes_verificaciones (
    id                 uuid          primary key default gen_random_uuid(),
    reposicion_id      uuid          not null references public.reposiciones (id) on update no action on delete restrict,
    usuario_id         uuid          not null references public.perfiles (id) on update no action on delete restrict,
    monto              numeric(14,2) not null,
    resultado          text          not null,
    huella             text,
    referencia_externa text,
    correlacion_id     uuid,
    creado_en          timestamptz   not null default now(),
    consumida_en       timestamptz,
    constraint hermes_resultado_ck check (resultado in ('VALIDO', 'INVALIDO', 'EXPIRADO', 'NO_CONFIGURADO', 'NO_DISPONIBLE')),
    constraint hermes_huella_ck    check (huella is null or huella ~ '^[0-9a-f]{64}$'),
    constraint hermes_monto_ck     check (monto > 0)
);
-- Un código aceptado no puede reutilizarse (ni en otra reposición).
create unique index if not exists hermes_huella_uq on public.hermes_verificaciones (huella) where huella is not null;
create index if not exists hermes_intentos_idx on public.hermes_verificaciones (reposicion_id, usuario_id, creado_en desc);

do $$
begin
    if not exists (select 1 from pg_constraint
                   where conname = 'reposiciones_hermes_fk' and conrelid = 'public.reposiciones'::regclass) then
        alter table public.reposiciones
            add constraint reposiciones_hermes_fk foreign key (hermes_verificacion_id)
            references public.hermes_verificaciones (id) on update no action on delete restrict;
    end if;
    if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'reposiciones_hermes_uq') then
        create unique index reposiciones_hermes_uq on public.reposiciones (hermes_verificacion_id)
            where hermes_verificacion_id is not null;
    end if;
end;
$$;

-- ------------------------------------------------------------------------------------------------ reposicion_recepciones
-- Cada ingreso de dinero es un registro independiente (recepciones parciales). La clave de idempotencia evita
-- contabilizar dos veces el mismo envío del formulario.
create table if not exists public.reposicion_recepciones (
    id                    uuid          primary key default gen_random_uuid(),
    reposicion_id         uuid          not null references public.reposiciones (id) on update no action on delete restrict,
    importe               numeric(14,2) not null,
    recibido_en_declarado timestamptz,
    registrado_por        uuid          not null references public.perfiles (id) on update no action on delete restrict,
    registrado_en         timestamptz   not null default now(),   -- marca OFICIAL del servidor; el usuario no la controla
    referencia            text,
    comentarios           text,
    clave_idempotencia    text          not null,
    constraint recepciones_importe_ck check (importe > 0),
    constraint recepciones_clave_uq   unique (reposicion_id, clave_idempotencia)
);
create index if not exists recepciones_reposicion_idx on public.reposicion_recepciones (reposicion_id, registrado_en);

-- ------------------------------------------------------------------------------------------------ reposicion_incidencias
create table if not exists public.reposicion_incidencias (
    id             uuid          primary key default gen_random_uuid(),
    reposicion_id  uuid          not null references public.reposiciones (id) on update no action on delete restrict,
    tipo           text          not null,
    importe        numeric(14,2) not null,
    descripcion    text          not null,
    estado         text          not null default 'ABIERTA',
    reportada_por  uuid          references public.perfiles (id) on update no action on delete restrict,  -- NULL = el sistema
    reportada_en   timestamptz   not null default now(),
    resuelta_por   uuid          references public.perfiles (id) on update no action on delete restrict,
    resuelta_en    timestamptz,
    resolucion     text,
    constraint incidencias_tipo_ck     check (tipo in ('DIFERENCIA_ENVIO_RECEPCION', 'EXCEDENTE', 'FALTANTE', 'OTRO')),
    constraint incidencias_importe_ck  check (importe >= 0),
    constraint incidencias_desc_ck     check (length(btrim(descripcion)) >= 5),
    constraint incidencias_estado_ck   check (estado in ('ABIERTA', 'RESUELTA')),
    constraint incidencias_resuelta_ck check (estado <> 'RESUELTA'
                                              or (resuelta_por is not null and resuelta_en is not null
                                                  and resolucion is not null and length(btrim(resolucion)) >= 5))
);
create index if not exists incidencias_reposicion_idx on public.reposicion_incidencias (reposicion_id, estado);
create index if not exists incidencias_abiertas_idx   on public.reposicion_incidencias (estado) where estado = 'ABIERTA';

-- ------------------------------------------------------------------------------------------------ caja_movimientos
-- Libro de movimientos de efectivo (solo inserción). El saldo de cajas es siempre el saldo_despues del último movimiento.
create table if not exists public.caja_movimientos (
    id             uuid          primary key default gen_random_uuid(),
    numero         bigint        generated always as identity,
    caja_id        uuid          not null references public.cajas (id) on update no action on delete restrict,
    tipo           text          not null,
    sentido        text          not null,
    importe        numeric(14,2) not null,
    saldo_antes    numeric(14,2) not null,
    saldo_despues  numeric(14,2) not null,
    prestamo_id    uuid          references public.prestamos (id) on update no action on delete restrict,
    reposicion_id  uuid          references public.reposiciones (id) on update no action on delete restrict,
    recepcion_id   uuid          references public.reposicion_recepciones (id) on update no action on delete restrict,
    referencia     text,
    creado_por     uuid          not null references public.perfiles (id) on update no action on delete restrict,
    creado_en      timestamptz   not null default now(),
    correlacion_id uuid,
    constraint movimientos_tipo_ck    check (tipo in ('APERTURA', 'DESEMBOLSO', 'REPOSICION', 'AJUSTE')),
    constraint movimientos_sentido_ck check (sentido in ('ENTRADA', 'SALIDA')),
    constraint movimientos_importe_ck check (importe > 0),
    constraint movimientos_saldos_ck  check (saldo_antes >= 0 and saldo_despues >= 0),
    constraint movimientos_aritmetica_ck check (
        (sentido = 'ENTRADA' and saldo_despues = saldo_antes + importe)
        or (sentido = 'SALIDA' and saldo_despues = saldo_antes - importe)),
    constraint movimientos_origen_ck check (
        (tipo = 'DESEMBOLSO'  and sentido = 'SALIDA'  and prestamo_id is not null)
        or (tipo = 'REPOSICION' and sentido = 'ENTRADA' and recepcion_id is not null and reposicion_id is not null)
        or (tipo = 'APERTURA'   and sentido = 'ENTRADA')
        or (tipo = 'AJUSTE'     and referencia is not null and length(btrim(referencia)) >= 5))
);
create index if not exists movimientos_caja_idx on public.caja_movimientos (caja_id, numero desc);
create index if not exists movimientos_fecha_idx on public.caja_movimientos (creado_en desc);
-- Idempotencia: un préstamo descuenta UNA vez; una recepción suma UNA vez; una caja se abre UNA vez.
create unique index if not exists movimientos_desembolso_uq on public.caja_movimientos (prestamo_id) where tipo = 'DESEMBOLSO';
create unique index if not exists movimientos_recepcion_uq  on public.caja_movimientos (recepcion_id) where recepcion_id is not null;
create unique index if not exists movimientos_apertura_uq   on public.caja_movimientos (caja_id) where tipo = 'APERTURA';

-- ------------------------------------------------------------------------------------------------ caja_auditoria
-- Registro de auditoría (solo inserción) y fuente de la línea de tiempo: solo contiene hechos que ocurrieron.
-- Nunca guarda códigos Hermes, claves ni secretos.
create table if not exists public.caja_auditoria (
    id             uuid          primary key default gen_random_uuid(),
    caja_id        uuid          references public.cajas (id) on update no action on delete restrict,
    reposicion_id  uuid          references public.reposiciones (id) on update no action on delete restrict,
    actor_id       uuid          references public.perfiles (id) on update no action on delete restrict,
    accion         text          not null,
    importe        numeric(14,2),
    detalle        text,
    correlacion_id uuid,
    creado_en      timestamptz   not null default now(),
    constraint auditoria_accion_ck check (length(btrim(accion)) > 0)
);
create index if not exists auditoria_reposicion_idx on public.caja_auditoria (reposicion_id, creado_en);
create index if not exists auditoria_caja_idx       on public.caja_auditoria (caja_id, creado_en desc);

-- ------------------------------------------------------------------------------------------------ funciones y triggers
-- Solo inserción.
create or replace function public.caja_solo_insercion() returns trigger
language plpgsql as $$
begin
    raise exception '% es de solo inserción: no se permite % sobre un registro contabilizado. Para corregir, registra un ajuste.',
        tg_table_name, tg_op using errcode = '23001';
end;
$$;

drop trigger if exists caja_movimientos_inmutable_tg on public.caja_movimientos;
create trigger caja_movimientos_inmutable_tg before update or delete on public.caja_movimientos
    for each row execute function public.caja_solo_insercion();
drop trigger if exists caja_movimientos_sin_truncate_tg on public.caja_movimientos;
create trigger caja_movimientos_sin_truncate_tg before truncate on public.caja_movimientos
    for each statement execute function public.caja_solo_insercion();

drop trigger if exists caja_auditoria_inmutable_tg on public.caja_auditoria;
create trigger caja_auditoria_inmutable_tg before update or delete on public.caja_auditoria
    for each row execute function public.caja_solo_insercion();
drop trigger if exists caja_auditoria_sin_truncate_tg on public.caja_auditoria;
create trigger caja_auditoria_sin_truncate_tg before truncate on public.caja_auditoria
    for each statement execute function public.caja_solo_insercion();

drop trigger if exists reposicion_recepciones_inmutable_tg on public.reposicion_recepciones;
create trigger reposicion_recepciones_inmutable_tg before update or delete on public.reposicion_recepciones
    for each row execute function public.caja_solo_insercion();
drop trigger if exists reposicion_recepciones_sin_truncate_tg on public.reposicion_recepciones;
create trigger reposicion_recepciones_sin_truncate_tg before truncate on public.reposicion_recepciones
    for each statement execute function public.caja_solo_insercion();

-- Un movimiento aplica el saldo: bloquea la caja, comprueba que el saldo_antes sea el real (nadie se interpuso) y lo
-- actualiza. Los CHECK de cajas (0 <= saldo <= limite) rechazan cualquier movimiento que desborde el límite.
create or replace function public.caja_movimientos_aplicar() returns trigger
language plpgsql as $$
declare
    v_saldo numeric(14,2);
begin
    select saldo into v_saldo from public.cajas where id = new.caja_id for update;
    if not found then
        raise exception 'La caja % no existe.', new.caja_id using errcode = '23503';
    end if;
    if new.saldo_antes <> v_saldo then
        raise exception 'El saldo de la caja cambió (esperado %, actual %): reintenta la operación.', new.saldo_antes, v_saldo
            using errcode = '40001';   -- serialization_failure
    end if;
    perform set_config('nexora.aplicando_movimiento', '1', true);
    update public.cajas set saldo = new.saldo_despues, actualizado_en = now() where id = new.caja_id;
    perform set_config('nexora.aplicando_movimiento', '', true);
    return new;
end;
$$;

drop trigger if exists caja_movimientos_aplicar_tg on public.caja_movimientos;
create trigger caja_movimientos_aplicar_tg before insert on public.caja_movimientos
    for each row execute function public.caja_movimientos_aplicar();

-- El saldo no se edita a mano: solo lo cambia el trigger anterior.
create or replace function public.cajas_proteger_saldo() returns trigger
language plpgsql as $$
begin
    if tg_op = 'DELETE' then
        raise exception 'Una caja no se elimina.' using errcode = '23001';
    end if;
    if new.saldo is distinct from old.saldo
       and coalesce(current_setting('nexora.aplicando_movimiento', true), '') <> '1' then
        raise exception 'El saldo de la caja solo cambia mediante un movimiento de caja_movimientos.' using errcode = '23001';
    end if;
    if new.asesor_id <> old.asesor_id or new.saldo_inicial <> old.saldo_inicial then
        raise exception 'El asesor y el saldo inicial de una caja no se modifican.' using errcode = '23001';
    end if;
    return new;
end;
$$;

drop trigger if exists cajas_proteger_saldo_tg on public.cajas;
create trigger cajas_proteger_saldo_tg before update or delete on public.cajas
    for each row execute function public.cajas_proteger_saldo();

-- ------------------------------------------------------------------------------------------------ seguridad (RLS)
-- Mismo criterio que contratos_prestamo: sin políticas RLS, la API pública de Supabase (anon/authenticated) queda
-- denegada; el backend usa el rol propietario, que no queda sujeto a RLS.
alter table public.cajas                  enable row level security;
alter table public.reposiciones           enable row level security;
alter table public.hermes_verificaciones  enable row level security;
alter table public.reposicion_recepciones enable row level security;
alter table public.reposicion_incidencias enable row level security;
alter table public.caja_movimientos       enable row level security;
alter table public.caja_auditoria         enable row level security;

-- ------------------------------------------------------------------------------------------------ reversión (referencia)
-- Solo viable ANTES de usar el módulo (después se perdería el historial financiero). No ejecutar en producción con datos:
--   drop table public.caja_auditoria, public.caja_movimientos, public.reposicion_incidencias,
--              public.reposicion_recepciones, public.reposiciones cascade;   -- y luego hermes_verificaciones y cajas
--   drop function public.caja_movimientos_aplicar(), public.cajas_proteger_saldo(), public.caja_solo_insercion();
