package com.nexora.backend.prestamos.configuracion;

import java.time.Clock;
import java.time.ZoneId;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RelojConfiguracion {

    /** El préstamo se registra el día en que el cliente se presenta en agencia: hora de Perú. */
    @Bean
    Clock reloj() {
        return Clock.system(ZoneId.of("America/Lima"));
    }
}