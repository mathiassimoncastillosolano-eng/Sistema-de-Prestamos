package com.nexora.backend.clientes.excepciones;

import com.nexora.backend.autenticacion.dto.ErrorRespuesta;
import com.nexora.backend.clientes.controladores.ClienteControlador;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice(basePackageClasses = ClienteControlador.class)
@Order(Ordered.HIGHEST_PRECEDENCE)
public class ManejadorErroresClientes {

    private static final Logger LOG = LoggerFactory.getLogger(ManejadorErroresClientes.class);

    @ExceptionHandler(ClienteException.class)
    public ResponseEntity<ErrorRespuesta> cliente(ClienteException e) {
        ClienteException.Codigo c = e.getCodigo();
        return ResponseEntity.status(c.estado()).body(new ErrorRespuesta(c.name(), e.getMessage()));
    }


    @ExceptionHandler({ MethodArgumentNotValidException.class, HttpMessageNotReadableException.class,
            MissingServletRequestParameterException.class })
    public ResponseEntity<ErrorRespuesta> solicitudInvalida(Exception e) {
        String mensaje = ClienteException.Codigo.SOLICITUD_INVALIDA.mensaje();
        if (e instanceof MethodArgumentNotValidException m && m.getBindingResult().getFieldError() != null) {
            String detalle = m.getBindingResult().getFieldError().getDefaultMessage();
            if (detalle != null && !detalle.isBlank())
                mensaje = detalle;
        }
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ErrorRespuesta(ClienteException.Codigo.SOLICITUD_INVALIDA.name(), mensaje));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorRespuesta> inesperado(Exception e) {
        LOG.error("Error inesperado en la API de clientes: {}", e.getClass().getName());
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ErrorRespuesta("DESCONOCIDO", "No se pudo completar la operación. Inténtalo nuevamente."));
    }
}
