package com.nexora.backend.autenticacion.servicios;

import com.nexora.backend.autenticacion.excepciones.AutenticacionException;
import com.nexora.backend.autenticacion.excepciones.AutenticacionException.Codigo;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Limita los intentos fallidos de inicio de sesion por correo (en memoria, una sola instancia).
 * Con varias instancias del backend habria que moverlo a un almacen compartido.
 */
@Component
public class LimitadorIntentos {

    private static final int LIMITE_ENTRADAS = 10_000;

    private static final class Registro {
        int fallos;
        Instant inicioVentana;
        Instant bloqueadoHasta;
    }

    private final Map<String, Registro> registros = new ConcurrentHashMap<>();
    private final int maxIntentos;
    private final Duration ventana;
    private final Duration bloqueo;
    private final Clock reloj;

    @Autowired
    public LimitadorIntentos(
            @Value("${nexora.seguridad.login.max-intentos:5}") int maxIntentos,
            @Value("${nexora.seguridad.login.ventana-minutos:15}") long ventanaMinutos,
            @Value("${nexora.seguridad.login.bloqueo-minutos:15}") long bloqueoMinutos) {
        this(maxIntentos, Duration.ofMinutes(ventanaMinutos), Duration.ofMinutes(bloqueoMinutos), Clock.systemUTC());
    }

    LimitadorIntentos(int maxIntentos, Duration ventana, Duration bloqueo, Clock reloj) {
        this.maxIntentos = maxIntentos;
        this.ventana = ventana;
        this.bloqueo = bloqueo;
        this.reloj = reloj;
    }

    /** Lanza DEMASIADOS_INTENTOS si la clave esta bloqueada. */
    public void verificarNoBloqueado(String clave) {
        Registro r = registros.get(clave);
        if (r == null) return;
        synchronized (r) {
            if (r.bloqueadoHasta != null && reloj.instant().isBefore(r.bloqueadoHasta)) {
                throw new AutenticacionException(Codigo.DEMASIADOS_INTENTOS);
            }
        }
    }

    public void registrarFallo(String clave) {
        if (registros.size() > LIMITE_ENTRADAS) purgar();
        Instant ahora = reloj.instant();
        Registro r = registros.computeIfAbsent(clave, k -> new Registro());
        synchronized (r) {
            if (r.inicioVentana == null || ahora.isAfter(r.inicioVentana.plus(ventana))) {
                r.inicioVentana = ahora;
                r.fallos = 0;
                r.bloqueadoHasta = null;
            }
            r.fallos++;
            if (r.fallos >= maxIntentos) r.bloqueadoHasta = ahora.plus(bloqueo);
        }
    }

    public void reiniciar(String clave) {
        registros.remove(clave);
    }

    private void purgar() {
        Instant ahora = reloj.instant();
        registros.entrySet().removeIf(e -> {
            Registro r = e.getValue();
            synchronized (r) {
                boolean bloqueoVigente = r.bloqueadoHasta != null && ahora.isBefore(r.bloqueadoHasta);
                boolean ventanaVigente = r.inicioVentana != null && !ahora.isAfter(r.inicioVentana.plus(ventana));
                return !bloqueoVigente && !ventanaVigente;
            }
        });
    }
}
