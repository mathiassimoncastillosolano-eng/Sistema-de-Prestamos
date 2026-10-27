package com.nexora.backend.caja.servicios;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.nexora.backend.autenticacion.entidades.Agencia;
import com.nexora.backend.autenticacion.entidades.Perfil;
import com.nexora.backend.caja.dominio.EstadoReposicion;
import com.nexora.backend.caja.dto.CajaDtos.AprobarReposicion;
import com.nexora.backend.caja.dto.CajaDtos.Recepcion;
import com.nexora.backend.caja.dto.CajaDtos.SolicitudReposicion;
import com.nexora.backend.caja.excepciones.CajaException;
import com.nexora.backend.caja.excepciones.CajaException.Codigo;
import com.nexora.backend.caja.hermes.HermesVerificador;
import com.nexora.backend.caja.hermes.ResultadoHermes;
import com.nexora.backend.caja.repositorios.CajaRepositorio;
import com.nexora.backend.caja.repositorios.CajaRepositorio.CajaFila;
import com.nexora.backend.caja.repositorios.ReposicionRepositorio;
import com.nexora.backend.caja.repositorios.ReposicionRepositorio.Registro;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.function.Executable;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.transaction.PlatformTransactionManager;

/**
 * Reglas de la reposición con repositorios simulados: aquí se prueban los RECHAZOS (que ocurren antes de tocar dinero).
 * Los caminos que sí mueven dinero (atomicidad, concurrencia, idempotencia) se prueban contra PostgreSQL real en
 * {@code ReposicionPostgresTest} (requiere PRUEBA_PG_URL).
 */
class ReposicionServicioTest {

    private final ReposicionRepositorio reposiciones = mock(ReposicionRepositorio.class);
    private final CajaRepositorio cajas = mock(CajaRepositorio.class);
    private final CajaServicio cajaServicio = mock(CajaServicio.class);
    @SuppressWarnings("unchecked")
    private final ObjectProvider<HermesVerificador> hermes = mock(ObjectProvider.class);
    private final HermesVerificador verificador = mock(HermesVerificador.class);
    private final PlatformTransactionManager tm = mock(PlatformTransactionManager.class);
    private final Clock reloj = Clock.fixed(Instant.parse("2026-10-26T15:00:00Z"), ZoneOffset.UTC);

    private final UUID cajaId = UUID.randomUUID();
    private final UUID asesorId = UUID.randomUUID();
    private final UUID gerenteId = UUID.randomUUID();
    private final UUID reposicionId = UUID.randomUUID();
    private final Perfil asesor = mock(Perfil.class);
    private final Perfil gerente = mock(Perfil.class);
    private ReposicionServicio servicio;

    @BeforeEach
    void preparar() {
        when(asesor.getId()).thenReturn(asesorId);
        when(asesor.getRol()).thenReturn("asesor");
        when(asesor.getAgencia()).thenReturn(mock(Agencia.class));
        when(gerente.getId()).thenReturn(gerenteId);
        when(gerente.getRol()).thenReturn("gerencia");
        when(hermes.getIfAvailable(any())).thenReturn(verificador);
        servicio = new ReposicionServicio(reposiciones, cajas, cajaServicio, hermes, tm, reloj, "secreto-de-prueba");
        caja("20000.00", "0.00");
        pendiente("10000.00", 3);
    }

    private static BigDecimal d(String v) {
        return new BigDecimal(v);
    }

    private void caja(String saldo, String autorizadoPendiente) {
        CajaFila c = new CajaFila(cajaId, asesorId, UUID.randomUUID(), d("50000.00"), d(saldo), d("50000.00"), "ABIERTA", Instant.EPOCH);
        when(cajas.porId(cajaId)).thenReturn(Optional.of(c));
        when(cajas.bloquearPorId(cajaId)).thenReturn(Optional.of(c));
        when(cajaServicio.bloquearCaja(any())).thenReturn(c);
        when(cajas.autorizadoPendiente(eq(cajaId), any())).thenReturn(d(autorizadoPendiente));
    }

    private Registro registro(EstadoReposicion estado, String solicitado, String autorizado, String recibido, int version) {
        return new Registro(reposicionId, 7, cajaId, asesorId, UUID.randomUUID(), d(solicitado), "DESEMBOLSOS_PROGRAMADOS", "comentario largo",
                d("20000.00"), d("30000.00"), estado, autorizado == null ? null : d(autorizado), null,
                Instant.parse("2026-10-26T12:00:00Z"), null, null, null, null, null, d(recibido), d("0.00"), version,
                Instant.EPOCH, Instant.EPOCH);
    }

    private void pendiente(String solicitado, int version) {
        when(reposiciones.porId(reposicionId)).thenReturn(Optional.of(registro(EstadoReposicion.PENDIENTE_APROBACION, solicitado, null, "0.00", version)));
    }

    private CajaException rechaza(Codigo esperado, Executable accion) {
        CajaException ex = assertThrows(CajaException.class, accion);
        assertEquals(esperado, ex.getCodigo(), ex.getMessage());
        return ex;
    }

    private void nadaSeAprobo() {
        verify(reposiciones, never()).aprobar(any(), any(), any(), any(), any());
        verify(reposiciones, never()).consumirHermes(any());
    }

    private AprobarReposicion aprobacion(String monto, String justificacion, String codigo, Integer version) {
        return new AprobarReposicion(monto == null ? null : d(monto), justificacion, codigo, version);
    }

    // ------------------------------------------------------------ aprobación y Hermes

    @Test
    void sin_adaptador_de_hermes_no_se_puede_aprobar_y_el_intento_queda_registrado() {
        when(hermes.getIfAvailable(any())).thenAnswer(i -> ((java.util.function.Supplier<?>) i.getArgument(0)).get());
        rechaza(Codigo.HERMES_NO_CONFIGURADO, () -> servicio.aprobar(gerente, reposicionId, aprobacion("10000", null, "12345678", 3)));
        nadaSeAprobo();
        verify(reposiciones).registrarIntentoHermes(eq(reposicionId), eq(gerenteId), eq(d("10000")), eq("NO_CONFIGURADO"), eq(null), eq(null), any());
    }

    @Test
    void un_codigo_que_no_tiene_ocho_digitos_ni_siquiera_se_envia_a_hermes() {
        for (String malo : new String[] {null, "", "1234567", "123456789", "1234567a", "12 45678"}) {
            rechaza(Codigo.CODIGO_HERMES_FORMATO, () -> servicio.aprobar(gerente, reposicionId, aprobacion("10000", null, malo, 3)));
        }
        verify(verificador, never()).verificar(any());
        nadaSeAprobo();
    }

    @Test
    void un_codigo_invalido_o_vencido_no_aprueba() {
        when(verificador.verificar(any())).thenReturn(ResultadoHermes.de(ResultadoHermes.Estado.INVALIDO));
        rechaza(Codigo.CODIGO_HERMES_INVALIDO, () -> servicio.aprobar(gerente, reposicionId, aprobacion("10000", null, "12345678", 3)));
        when(verificador.verificar(any())).thenReturn(ResultadoHermes.de(ResultadoHermes.Estado.EXPIRADO));
        rechaza(Codigo.CODIGO_HERMES_INVALIDO, () -> servicio.aprobar(gerente, reposicionId, aprobacion("10000", null, "12345678", 3)));
        nadaSeAprobo();
        verify(reposiciones).registrarIntentoHermes(eq(reposicionId), eq(gerenteId), any(), eq("INVALIDO"), eq(null), any(), any());
        verify(reposiciones).registrarIntentoHermes(eq(reposicionId), eq(gerenteId), any(), eq("EXPIRADO"), eq(null), any(), any());
    }

    @Test
    void si_hermes_falla_o_no_responde_no_se_aprueba_nada() {
        when(verificador.verificar(any())).thenThrow(new IllegalStateException("timeout"));
        rechaza(Codigo.HERMES_NO_DISPONIBLE, () -> servicio.aprobar(gerente, reposicionId, aprobacion("10000", null, "12345678", 3)));
        nadaSeAprobo();
    }

    @Test
    void tras_cinco_intentos_fallidos_se_bloquea_antes_de_consultar_a_hermes() {
        when(reposiciones.hermesFallidosRecientes(eq(reposicionId), eq(gerenteId), anyInt())).thenReturn(5);
        rechaza(Codigo.HERMES_BLOQUEADO, () -> servicio.aprobar(gerente, reposicionId, aprobacion("10000", null, "12345678", 3)));
        verify(verificador, never()).verificar(any());
        nadaSeAprobo();
    }

    @Test
    void el_codigo_nunca_viaja_a_la_auditoria_ni_a_los_registros_de_intento() {
        when(verificador.verificar(any())).thenReturn(ResultadoHermes.de(ResultadoHermes.Estado.INVALIDO));
        assertThrows(CajaException.class, () -> servicio.aprobar(gerente, reposicionId, aprobacion("10000", null, "12345678", 3)));
        verify(reposiciones, never()).registrarIntentoHermes(any(), any(), any(), anyString(), eq("12345678"), any(), any());
        verify(reposiciones, never()).auditar(any(), any(), any(), any(), any(), org.mockito.ArgumentMatchers.contains("12345678"), any());
        assertEquals(false, aprobacion("10000", null, "12345678", 3).toString().contains("12345678"));
    }

    @Test
    void no_se_puede_autorizar_mas_de_lo_solicitado() {
        rechaza(Codigo.DATOS_INVALIDOS, () -> servicio.aprobar(gerente, reposicionId, aprobacion("10000.01", null, "12345678", 3)));
        verify(verificador, never()).verificar(any());
    }

    @Test
    void autorizar_menos_de_lo_solicitado_exige_justificacion() {
        rechaza(Codigo.DATOS_INVALIDOS, () -> servicio.aprobar(gerente, reposicionId, aprobacion("6000", null, "12345678", 3)));
        rechaza(Codigo.DATOS_INVALIDOS, () -> servicio.aprobar(gerente, reposicionId, aprobacion("6000", "corto", "12345678", 3)));
        verify(verificador, never()).verificar(any());
    }

    @Test
    void importes_cero_negativos_o_ausentes_se_rechazan() {
        for (String monto : new String[] {null, "0", "-5"}) {
            rechaza(Codigo.DATOS_INVALIDOS, () -> servicio.aprobar(gerente, reposicionId, aprobacion(monto, null, "12345678", 3)));
        }
    }

    @Test
    void no_se_autoriza_si_con_ello_la_caja_pasaria_de_50000() {
        caja("45000.00", "0.00");
        pendiente("10000.00", 3);
        rechaza(Codigo.MONTO_EXCEDE_CAPACIDAD, () -> servicio.aprobar(gerente, reposicionId, aprobacion("5000.01", "recorte por límite", "12345678", 3)));
        verify(verificador, never()).verificar(any());
    }

    @Test
    void lo_ya_autorizado_pendiente_de_recibir_cuenta_contra_la_capacidad() {
        caja("30000.00", "15000.00"); // 30,000 en caja + 15,000 por llegar = solo caben 5,000 más
        rechaza(Codigo.MONTO_EXCEDE_CAPACIDAD, () -> servicio.aprobar(gerente, reposicionId, aprobacion("10000", null, "12345678", 3)));
    }

    @Test
    void el_asesor_no_puede_aprobar_ni_siquiera_su_propia_solicitud() {
        rechaza(Codigo.SIN_PERMISO, () -> servicio.aprobar(asesor, reposicionId, aprobacion("10000", null, "12345678", 3)));
        // y una gerencia que además fuera la dueña de la solicitud tampoco
        when(gerente.getId()).thenReturn(asesorId);
        rechaza(Codigo.SIN_PERMISO, () -> servicio.aprobar(gerente, reposicionId, aprobacion("10000", null, "12345678", 3)));
        verify(verificador, never()).verificar(any());
    }

    @Test
    void solo_se_aprueba_una_solicitud_pendiente() {
        for (EstadoReposicion e : EstadoReposicion.values()) {
            if (e == EstadoReposicion.PENDIENTE_APROBACION) continue;
            when(reposiciones.porId(reposicionId)).thenReturn(Optional.of(registro(e, "10000.00", "10000.00", "0.00", 3)));
            rechaza(Codigo.ESTADO_INVALIDO, () -> servicio.aprobar(gerente, reposicionId, aprobacion("10000", null, "12345678", 3)));
        }
        verify(verificador, never()).verificar(any());
    }

    @Test
    void una_version_desactualizada_se_rechaza() {
        rechaza(Codigo.VERSION_DESACTUALIZADA, () -> servicio.aprobar(gerente, reposicionId, aprobacion("10000", null, "12345678", 2)));
        verify(verificador, never()).verificar(any());
    }

    @Test
    void reposicion_inexistente() {
        when(reposiciones.porId(any())).thenReturn(Optional.empty());
        rechaza(Codigo.REPOSICION_NO_ENCONTRADA, () -> servicio.aprobar(gerente, UUID.randomUUID(), aprobacion("10000", null, "12345678", 3)));
    }

    // ------------------------------------------------------------ solicitud

    private SolicitudReposicion solicitud(String monto, String motivo, String comentarios, String clave) {
        return new SolicitudReposicion(monto == null ? null : d(monto), motivo, comentarios, clave);
    }

    @Test
    void la_solicitud_valida_sus_campos_en_el_servidor() {
        rechaza(Codigo.DATOS_INVALIDOS, () -> servicio.solicitar(asesor, solicitud(null, "DESEMBOLSOS_PROGRAMADOS", "necesito efectivo", "clave-12345")));
        rechaza(Codigo.DATOS_INVALIDOS, () -> servicio.solicitar(asesor, solicitud("0", "DESEMBOLSOS_PROGRAMADOS", "necesito efectivo", "clave-12345")));
        rechaza(Codigo.DATOS_INVALIDOS, () -> servicio.solicitar(asesor, solicitud("-10", "DESEMBOLSOS_PROGRAMADOS", "necesito efectivo", "clave-12345")));
        rechaza(Codigo.DATOS_INVALIDOS, () -> servicio.solicitar(asesor, solicitud("100", "INVENTADO", "necesito efectivo", "clave-12345")));
        rechaza(Codigo.DATOS_INVALIDOS, () -> servicio.solicitar(asesor, solicitud("100", "DESEMBOLSOS_PROGRAMADOS", "corto", "clave-12345")));
        rechaza(Codigo.DATOS_INVALIDOS, () -> servicio.solicitar(asesor, solicitud("100", "DESEMBOLSOS_PROGRAMADOS", "necesito efectivo", "x")));
        verify(reposiciones, never()).insertar(any(), any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void la_gerencia_no_pide_reposiciones() {
        rechaza(Codigo.SIN_PERMISO, () -> servicio.solicitar(gerente, solicitud("100", "DESEMBOLSOS_PROGRAMADOS", "necesito efectivo", "clave-12345")));
    }

    @Test
    void no_se_puede_solicitar_mas_de_lo_que_cabe_en_la_caja() {
        caja("20000.00", "0.00");           // caben 30,000
        rechaza(Codigo.MONTO_EXCEDE_CAPACIDAD, () -> servicio.solicitar(asesor, solicitud("30000.01", "DESEMBOLSOS_PROGRAMADOS", "necesito efectivo", "clave-12345")));
        caja("50000.00", "0.00");           // caja llena
        rechaza(Codigo.MONTO_EXCEDE_CAPACIDAD, () -> servicio.solicitar(asesor, solicitud("1", "DESEMBOLSOS_PROGRAMADOS", "necesito efectivo", "clave-12345")));
        verify(reposiciones, never()).insertar(any(), any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void con_una_reposicion_en_tramite_no_se_permite_otra() {
        when(reposiciones.porClave(any(), any())).thenReturn(Optional.empty());
        when(reposiciones.abiertaDeCaja(cajaId)).thenReturn(Optional.of(registro(EstadoReposicion.EN_TRANSITO, "10000.00", "10000.00", "0.00", 4)));
        rechaza(Codigo.REPOSICION_EN_TRAMITE, () -> servicio.solicitar(asesor, solicitud("100", "DESEMBOLSOS_PROGRAMADOS", "necesito efectivo", "clave-12345")));
        verify(reposiciones, never()).insertar(any(), any(), any(), any(), any(), any(), any(), any(), any());
    }

    // ------------------------------------------------------------ recepción

    private Recepcion recepcion(String importe, String clave) {
        return new Recepcion(d(importe), null, null, null, clave);
    }

    private void aprobada(String autorizado, String recibido) {
        when(reposiciones.porId(reposicionId)).thenReturn(Optional.of(registro(EstadoReposicion.APROBADA, autorizado, autorizado, recibido, 5)));
        when(reposiciones.porIdBloqueando(reposicionId)).thenReturn(Optional.of(registro(EstadoReposicion.APROBADA, autorizado, autorizado, recibido, 5)));
        when(reposiciones.recepcionPorClave(any(), any())).thenReturn(Optional.empty());
    }

    @Test
    void no_se_puede_recibir_mas_de_lo_autorizado_pendiente_y_el_excedente_no_se_contabiliza() {
        aprobada("10000.00", "4000.00");   // pendiente 6,000
        CajaException ex = rechaza(Codigo.EXCEDE_AUTORIZADO, () -> servicio.registrarRecepcion(asesor, reposicionId, recepcion("6000.01", "clave-12345")));
        assertEquals(d("6000.00"), ex.getDetalle().get("pendiente"));
        verify(reposiciones, never()).insertarRecepcion(any(), any(), any(), any(), any(), any(), any());
        verify(cajas, never()).insertarMovimiento(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void no_se_recibe_si_con_ello_la_caja_pasaria_de_50000() {
        caja("46000.00", "0.00");
        aprobada("10000.00", "0.00");
        rechaza(Codigo.EXCEDE_LIMITE_CAJA, () -> servicio.registrarRecepcion(asesor, reposicionId, recepcion("4000.01", "clave-12345")));
        verify(cajas, never()).insertarMovimiento(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void la_recepcion_exige_clave_de_idempotencia_importe_positivo_y_estado_que_la_admita() {
        aprobada("10000.00", "0.00");
        rechaza(Codigo.DATOS_INVALIDOS, () -> servicio.registrarRecepcion(asesor, reposicionId, recepcion("100", null)));
        rechaza(Codigo.DATOS_INVALIDOS, () -> servicio.registrarRecepcion(asesor, reposicionId, recepcion("0", "clave-12345")));
        when(reposiciones.porIdBloqueando(reposicionId)).thenReturn(Optional.of(registro(EstadoReposicion.PENDIENTE_APROBACION, "10000.00", null, "0.00", 1)));
        rechaza(Codigo.ESTADO_INVALIDO, () -> servicio.registrarRecepcion(asesor, reposicionId, recepcion("100", "clave-12345")));
        when(reposiciones.porIdBloqueando(reposicionId)).thenReturn(Optional.of(registro(EstadoReposicion.RECHAZADA, "10000.00", null, "0.00", 1)));
        rechaza(Codigo.ESTADO_INVALIDO, () -> servicio.registrarRecepcion(asesor, reposicionId, recepcion("100", "clave-12345")));
    }

    @Test
    void un_asesor_no_ve_ni_recibe_la_reposicion_de_otro() {
        aprobada("10000.00", "0.00");
        Perfil otro = mock(Perfil.class);
        when(otro.getId()).thenReturn(UUID.randomUUID());
        when(otro.getRol()).thenReturn("asesor");
        when(otro.getAgencia()).thenReturn(mock(Agencia.class));
        rechaza(Codigo.REPOSICION_NO_ENCONTRADA, () -> servicio.registrarRecepcion(otro, reposicionId, recepcion("100", "clave-12345")));
    }

    @Test
    void la_gerencia_no_registra_recepciones() {
        aprobada("10000.00", "0.00");
        rechaza(Codigo.SIN_PERMISO, () -> servicio.registrarRecepcion(gerente, reposicionId, recepcion("100", "clave-12345")));
    }
}
