package com.nexora.backend.prestamos.repositorios;

/**
 * ÚNICA definición del grupo crediticio: los clientes cuya deuda se suma para el límite de endeudamiento.
 *
 * <p>Regla (comprobada en la BD, no inferida): una persona natural (tipo_documento = 'DNI') y los negocios 'RUC 10' cuyo
 * {@code dni_titular} es ese mismo DNI son la misma persona frente al crédito. {@code clientes_datos_por_tipo_ck} obliga
 * a que todo RUC 10 tenga {@code dni_titular} de 8 dígitos, así que el vínculo existe siempre y no depende de nombres,
 * direcciones ni otros datos coincidentes.
 *
 * <p>Un 'RUC 20' NO se consolida con nadie: solo guarda {@code representante_dni}, y un representante legal no es
 * necesariamente propietario ni responde personalmente por la deuda de la empresa. Su grupo es él solo.
 *
 * <p>Las dos consultas comparten {@link #BASE} y {@link #CONDICION}: quien bloquea y quien lista ven exactamente los
 * mismos integrantes. El parámetro nombrado {@code :id} es el cliente consultado.
 */
public final class GrupoCrediticioSql {

    /** Cliente consultado y su DNI base: el propio si es DNI, su dni_titular si es RUC 10, ninguno si es RUC 20. */
    private static final String BASE = """
            with base as (
                select b0.id,
                       case b0.tipo_documento when 'DNI' then b0.numero_documento when 'RUC 10' then b0.dni_titular end as dni
                from public.clientes b0
                where b0.id = :id)
            """;

    /** El consultado siempre es integrante de su grupo; con DNI base, también el DNI y todos los RUC 10 de ese titular. */
    private static final String CONDICION = """
            c.id = b.id
               or (b.dni is not null
                   and ((c.tipo_documento = 'DNI' and c.numero_documento = b.dni)
                     or (c.tipo_documento = 'RUC 10' and c.dni_titular = b.dni)))
            """;

    /**
     * Bloquea las filas del grupo hasta el fin de la transacción, SIEMPRE en orden de id. Dos registros del mismo grupo
     * (aunque lleguen por el DNI y por el RUC 10) se serializan en la primera fila y nunca se esperan en círculo.
     */
    public static final String BLOQUEAR = BASE
            + "select c.id from public.clientes c join base b on " + CONDICION
            + " order by c.id for update of c";

    /** Integrantes del grupo con lo necesario para identificarlos y decidir qué detalle puede ver cada usuario. */
    public static final String INTEGRANTES = BASE
            + "select c.id, c.nombre, c.tipo_documento, c.numero_documento, c.agencia_id "
            + "from public.clientes c join base b on " + CONDICION
            + " order by c.id";

    private GrupoCrediticioSql() {
    }
}
