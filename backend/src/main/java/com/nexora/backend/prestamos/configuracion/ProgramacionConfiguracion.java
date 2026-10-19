package com.nexora.backend.prestamos.configuracion;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/** Activa las tareas programadas: el recálculo diario de clientes.estado (EstadoClienteServicio). */
@Configuration
@EnableScheduling
public class ProgramacionConfiguracion {
}
