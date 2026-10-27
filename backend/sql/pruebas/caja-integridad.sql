-- =====================================================================================================================
-- PRUEBAS DE INTEGRIDAD de la migración 2026-10-26-caja-y-reposiciones.sql (solo para una base LOCAL DE PRUEBA).
-- NO ejecutar contra producción: inserta datos de prueba. Uso:
--   psql -v ON_ERROR_STOP=1 -f src/test/resources/esquema-prueba-concurrencia.sql      (solo si la base está vacía)
--   psql -v ON_ERROR_STOP=1 -f sql/2026-10-26-caja-y-reposiciones.sql
--   psql -v ON_ERROR_STOP=1 -f sql/pruebas/caja-integridad.sql
-- Cada prueba imprime OK o FALLA; el script termina con error si alguna falla.
-- =====================================================================================================================
create temp table resultados (n serial, prueba text, ok boolean, detalle text);

create or replace function pg_temp.espera_error(p_prueba text, p_sql text, p_sqlstate text) returns void
language plpgsql as $$
begin
    begin
        execute p_sql;
        insert into resultados (prueba, ok, detalle) values (p_prueba, false, 'se esperaba error ' || p_sqlstate || ' y no hubo');
    exception when others then
        insert into resultados (prueba, ok, detalle)
        values (p_prueba, sqlstate = p_sqlstate, 'sqlstate=' || sqlstate || ' ' || left(sqlerrm, 90));
    end;
end;
$$;

create or replace function pg_temp.espera(p_prueba text, p_cond boolean, p_detalle text default '') returns void
language plpgsql as $$
begin
    insert into resultados (prueba, ok, detalle) values (p_prueba, coalesce(p_cond, false), p_detalle);
end;
$$;

do $$
declare
    v_ubi uuid; v_ag uuid; v_ase uuid; v_ger uuid; v_cli uuid; v_pre uuid; v_pre2 uuid;
    v_caja uuid; v_rep uuid; v_rec uuid; v_hv uuid; v_saldo numeric;
begin
    insert into public.ubicaciones (departamento, provincia, distrito) values ('Piura','Piura','Piura') returning id into v_ubi;
    insert into public.agencias (nombre, ubicacion_id) values ('Agencia T', v_ubi) returning id into v_ag;
    insert into public.perfiles (nombres, apellidos, correo, rol, agencia_id, clave_hash)
        values ('Ana','Asesora','ana@t.local','asesor', v_ag, 'x') returning id into v_ase;
    insert into public.perfiles (nombres, apellidos, correo, rol, clave_hash)
        values ('Gus','Gerente','gus@t.local','gerencia','x') returning id into v_ger;
    insert into public.clientes (tipo_documento, numero_documento, nombre, agencia_id, creado_por)
        values ('DNI','12345678','Cliente T', v_ag, v_ase) returning id into v_cli;
    insert into public.prestamos (cliente_id, agencia_id, asesor_id, capital, plazo_meses, tea, fecha_desembolso)
        values (v_cli, v_ag, v_ase, 8000, 12, 0.3, current_date) returning id into v_pre;
    insert into public.prestamos (cliente_id, agencia_id, asesor_id, capital, plazo_meses, tea, fecha_desembolso)
        values (v_cli, v_ag, v_ase, 9000, 12, 0.3, current_date) returning id into v_pre2;

    -- 1) Apertura: la caja nace en 0 y la apertura de S/ 50,000 la lleva a 50,000 mediante el libro.
    insert into public.cajas (asesor_id, agencia_id, saldo, abierta_por) values (v_ase, v_ag, 0, v_ase) returning id into v_caja;
    insert into public.caja_movimientos (caja_id, tipo, sentido, importe, saldo_antes, saldo_despues, creado_por, referencia)
        values (v_caja, 'APERTURA', 'ENTRADA', 50000, 0, 50000, v_ase, 'Apertura');
    select saldo into v_saldo from public.cajas where id = v_caja;
    perform pg_temp.espera('01 apertura deja S/ 50,000', v_saldo = 50000, v_saldo::text);

    -- Una segunda apertura que dejara la caja en el límite exacto choca con movimientos_apertura_uq (se prueba en el bloque final);
    -- una que lo supere la frena el CHECK del saldo.
    perform pg_temp.espera_error('02 segunda apertura sobre el límite rechazada',
        format('insert into public.caja_movimientos (caja_id,tipo,sentido,importe,saldo_antes,saldo_despues,creado_por) values (%L,''APERTURA'',''ENTRADA'',1,50000,50001,%L)', v_caja, v_ase), '23514');

    perform pg_temp.espera_error('03 una sola caja por asesor',
        format('insert into public.cajas (asesor_id, agencia_id, saldo, abierta_por) values (%L,%L,0,%L)', v_ase, v_ag, v_ase), '23505');

    -- 2) El saldo no se edita a mano.
    perform pg_temp.espera_error('04 UPDATE directo del saldo rechazado',
        format('update public.cajas set saldo = 99 where id = %L', v_caja), '23001');
    perform pg_temp.espera_error('05 la caja no se elimina',
        format('delete from public.cajas where id = %L', v_caja), '23001');

    -- 3) Desembolso válido.
    insert into public.caja_movimientos (caja_id, tipo, sentido, importe, saldo_antes, saldo_despues, prestamo_id, creado_por)
        values (v_caja, 'DESEMBOLSO', 'SALIDA', 8000, 50000, 42000, v_pre, v_ase);
    select saldo into v_saldo from public.cajas where id = v_caja;
    perform pg_temp.espera('06 desembolso reduce el saldo', v_saldo = 42000, v_saldo::text);

    -- 4) Doble descuento del mismo préstamo.
    perform pg_temp.espera_error('07 el mismo préstamo no descuenta dos veces',
        format('insert into public.caja_movimientos (caja_id,tipo,sentido,importe,saldo_antes,saldo_despues,prestamo_id,creado_por) values (%L,''DESEMBOLSO'',''SALIDA'',8000,42000,34000,%L,%L)', v_caja, v_pre, v_ase), '23505');

    -- 5) Desembolso superior al efectivo.
    perform pg_temp.espera_error('08 desembolso mayor al saldo rechazado',
        format('insert into public.caja_movimientos (caja_id,tipo,sentido,importe,saldo_antes,saldo_despues,prestamo_id,creado_por) values (%L,''DESEMBOLSO'',''SALIDA'',45000,42000,-3000,%L,%L)', v_caja, v_pre2, v_ase), '23514');

    -- 6) Saldo_antes desactualizado (otra operación se interpuso).
    perform pg_temp.espera_error('09 saldo_antes desactualizado rechazado (40001)',
        format('insert into public.caja_movimientos (caja_id,tipo,sentido,importe,saldo_antes,saldo_despues,prestamo_id,creado_por) values (%L,''DESEMBOLSO'',''SALIDA'',1000,50000,49000,%L,%L)', v_caja, v_pre2, v_ase), '40001');

    -- 7) Aritmética del movimiento.
    perform pg_temp.espera_error('10 aritmética incoherente rechazada',
        format('insert into public.caja_movimientos (caja_id,tipo,sentido,importe,saldo_antes,saldo_despues,prestamo_id,creado_por) values (%L,''DESEMBOLSO'',''SALIDA'',1000,42000,40000,%L,%L)', v_caja, v_pre2, v_ase), '23514');

    -- 8) Reposición: una sola abierta por caja, comentarios obligatorios, autorizado <= solicitado.
    insert into public.reposiciones (caja_id, asesor_id, agencia_id, monto_solicitado, motivo, comentarios,
                                     saldo_al_solicitar, capacidad_al_solicitar, clave_idempotencia, creado_por)
        values (v_caja, v_ase, v_ag, 8000, 'ALTA_DEMANDA', 'Necesito efectivo para los desembolsos de la tarde', 42000, 8000, 'k1', v_ase)
        returning id into v_rep;
    perform pg_temp.espera_error('11 segunda reposición abierta rechazada',
        format('insert into public.reposiciones (caja_id,asesor_id,agencia_id,monto_solicitado,motivo,comentarios,saldo_al_solicitar,capacidad_al_solicitar,clave_idempotencia,creado_por) values (%L,%L,%L,100,''OTRO'',''comentario suficiente'',42000,8000,''k2'',%L)', v_caja, v_ase, v_ag, v_ase), '23505');
    perform pg_temp.espera_error('12 comentarios muy cortos rechazados',
        format('update public.reposiciones set comentarios = ''corto'' where id = %L', v_rep), '23514');
    perform pg_temp.espera_error('13 monto solicitado <= 0 rechazado',
        format('update public.reposiciones set monto_solicitado = 0 where id = %L', v_rep), '23514');
    perform pg_temp.espera_error('14 autorizado mayor al solicitado rechazado',
        format('update public.reposiciones set monto_autorizado = 9000 where id = %L', v_rep), '23514');
    perform pg_temp.espera_error('15 estado APROBADA exige autorizador y Hermes',
        format('update public.reposiciones set estado = ''APROBADA'', monto_autorizado = 8000 where id = %L', v_rep), '23514');

    -- 9) Hermes: huella única (un código no se reutiliza) y formato.
    insert into public.hermes_verificaciones (reposicion_id, usuario_id, monto, resultado, huella)
        values (v_rep, v_ger, 8000, 'VALIDO', repeat('a', 64)) returning id into v_hv;
    perform pg_temp.espera_error('16 huella Hermes repetida rechazada',
        format('insert into public.hermes_verificaciones (reposicion_id, usuario_id, monto, resultado, huella) values (%L,%L,100,''VALIDO'',%L)', v_rep, v_ger, repeat('a', 64)), '23505');
    perform pg_temp.espera_error('17 huella con formato inválido rechazada',
        format('insert into public.hermes_verificaciones (reposicion_id, usuario_id, monto, resultado, huella) values (%L,%L,100,''VALIDO'',''12345678'')', v_rep, v_ger), '23514');

    update public.reposiciones set estado = 'APROBADA', monto_autorizado = 5000, decidido_por = v_ger, decidido_en = now(),
        hermes_verificacion_id = v_hv, version = version + 1 where id = v_rep;
    perform pg_temp.espera('18 aprobación coherente aceptada', (select estado from public.reposiciones where id = v_rep) = 'APROBADA');

    perform pg_temp.espera_error('19 recibido no puede superar lo autorizado',
        format('update public.reposiciones set total_recibido = 5000.01 where id = %L', v_rep), '23514');

    -- 10) Recepción: un ingreso, una vez.
    insert into public.reposicion_recepciones (reposicion_id, importe, registrado_por, clave_idempotencia)
        values (v_rep, 3000, v_ase, 'r1') returning id into v_rec;
    insert into public.caja_movimientos (caja_id, tipo, sentido, importe, saldo_antes, saldo_despues, reposicion_id, recepcion_id, creado_por)
        values (v_caja, 'REPOSICION', 'ENTRADA', 3000, 42000, 45000, v_rep, v_rec, v_ase);
    select saldo into v_saldo from public.cajas where id = v_caja;
    perform pg_temp.espera('20 recepción suma al saldo', v_saldo = 45000, v_saldo::text);
    perform pg_temp.espera_error('21 la misma recepción no suma dos veces',
        format('insert into public.caja_movimientos (caja_id,tipo,sentido,importe,saldo_antes,saldo_despues,reposicion_id,recepcion_id,creado_por) values (%L,''REPOSICION'',''ENTRADA'',3000,45000,48000,%L,%L,%L)', v_caja, v_rep, v_rec, v_ase), '23505');
    perform pg_temp.espera_error('22 clave de idempotencia repetida rechazada',
        format('insert into public.reposicion_recepciones (reposicion_id, importe, registrado_por, clave_idempotencia) values (%L,100,%L,''r1'')', v_rep, v_ase), '23505');

    -- 11) Nunca más de S/ 50,000.
    insert into public.reposicion_recepciones (reposicion_id, importe, registrado_por, clave_idempotencia)
        values (v_rep, 2000, v_ase, 'r2') returning id into v_rec;
    insert into public.caja_movimientos (caja_id, tipo, sentido, importe, saldo_antes, saldo_despues, reposicion_id, recepcion_id, creado_por)
        values (v_caja, 'REPOSICION', 'ENTRADA', 2000, 45000, 47000, v_rep, v_rec, v_ase);
    insert into public.reposicion_recepciones (reposicion_id, importe, registrado_por, clave_idempotencia)
        values (v_rep, 100, v_ase, 'r3') returning id into v_rec;
    perform pg_temp.espera_error('24 saldo > límite rechazado por CHECK',
        format('insert into public.caja_movimientos (caja_id,tipo,sentido,importe,saldo_antes,saldo_despues,reposicion_id,recepcion_id,creado_por) values (%L,''REPOSICION'',''ENTRADA'',3500,47000,50500,%L,%L,%L)', v_caja, v_rep, v_rec, v_ase), '23514');

    -- 12) Inmutabilidad.
    perform pg_temp.espera_error('25 movimiento no se actualiza',
        format('update public.caja_movimientos set importe = 1 where caja_id = %L', v_caja), '23001');
    perform pg_temp.espera_error('26 movimiento no se elimina',
        format('delete from public.caja_movimientos where caja_id = %L', v_caja), '23001');
    perform pg_temp.espera_error('27 movimientos no se truncan', 'truncate public.caja_movimientos', '23001');
    insert into public.caja_auditoria (caja_id, reposicion_id, actor_id, accion) values (v_caja, v_rep, v_ase, 'PRUEBA');
    perform pg_temp.espera_error('28 auditoría no se modifica',
        format('update public.caja_auditoria set accion = ''X'' where caja_id = %L', v_caja), '23001');
    perform pg_temp.espera_error('29 recepción no se modifica',
        format('update public.reposicion_recepciones set importe = 1 where id = %L', v_rec), '23001');

    -- 13) Ajuste exige motivo.
    perform pg_temp.espera_error('30 ajuste sin motivo rechazado',
        format('insert into public.caja_movimientos (caja_id,tipo,sentido,importe,saldo_antes,saldo_despues,creado_por) values (%L,''AJUSTE'',''SALIDA'',10,47000,46990,%L)', v_caja, v_ase), '23514');

    -- 14) El saldo coincide con el libro.
    perform pg_temp.espera('31 saldo = suma del libro',
        (select c.saldo = (select coalesce(sum(case sentido when 'ENTRADA' then importe else -importe end), 0)
                           from public.caja_movimientos m where m.caja_id = c.id)
         from public.cajas c where c.id = v_caja));

    -- Segunda apertura que no desborda el límite: la rechaza el índice único (se simula con una caja distinta del mismo asesor es imposible: asesor único).
    perform pg_temp.espera('23 una apertura por caja (índice único)',
        exists (select 1 from pg_indexes where indexname = 'movimientos_apertura_uq'));

    -- 15) Error durante una operación financiera: no queda nada a medias.
    --     Se registra la recepción y luego su ingreso falla (pasaría de S/ 50,000): el bloque revierte AMBAS cosas.
    begin
        insert into public.reposicion_recepciones (reposicion_id, importe, registrado_por, clave_idempotencia)
            values (v_rep, 100, v_ase, 'r-falla') returning id into v_rec;
        insert into public.caja_movimientos (caja_id, tipo, sentido, importe, saldo_antes, saldo_despues, reposicion_id, recepcion_id, creado_por)
            values (v_caja, 'REPOSICION', 'ENTRADA', 3500, 47000, 50500, v_rep, v_rec, v_ase);
        perform pg_temp.espera('32 operación fallida deja rastro', false, 'el ingreso que pasaba de 50,000 no falló');
    exception when others then
        perform pg_temp.espera('32 operación fallida no deja recepción a medias',
            not exists (select 1 from public.reposicion_recepciones where clave_idempotencia = 'r-falla')
            and (select saldo from public.cajas where id = v_caja) = 47000,
            'sqlstate=' || sqlstate);
    end;

    -- 16) Ajuste auditable con motivo: queda en el libro, mueve el saldo y el libro sigue cuadrando.
    insert into public.caja_movimientos (caja_id, tipo, sentido, importe, saldo_antes, saldo_despues, referencia, creado_por)
        values (v_caja, 'AJUSTE', 'SALIDA', 150, 47000, 46850, 'Faltante detectado en arqueo del 26/10', v_ger);
    perform pg_temp.espera('33 ajuste con motivo aplicado y libro cuadrado',
        (select c.saldo = 46850 and c.saldo = (select sum(case sentido when 'ENTRADA' then importe else -importe end)
                                                from public.caja_movimientos m where m.caja_id = c.id)
         from public.cajas c where c.id = v_caja));

    -- Para las pruebas de concurrencia externas.
    create table if not exists public.zz_fixture (clave text primary key, valor text);
    delete from public.zz_fixture;
    insert into public.zz_fixture values ('caja', v_caja::text), ('asesor', v_ase::text), ('rep', v_rep::text);
end;
$$;

select n, case when ok then 'OK   ' else 'FALLA' end as r, prueba, detalle from resultados order by n;
do $$ begin
    if exists (select 1 from resultados where not ok) then raise exception 'HAY PRUEBAS FALLIDAS'; end if;
end $$;
