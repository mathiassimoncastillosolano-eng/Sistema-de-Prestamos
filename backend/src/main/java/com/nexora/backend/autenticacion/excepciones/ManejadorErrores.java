package com.nexora.backend.autenticacion.excepciones;

import com.nexora.backend.autenticacion.dto.ErrorRespuesta;
import com.nexora.backend.autenticacion.excepciones.AutenticacionException.Codigo;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ManejadorErrores {

    private static final Logger LOG = LoggerFactory.getLogger(ManejadorErrores.class);

    @ExceptionHandler(AutenticacionException.class)
    public ResponseEntity<ErrorRespuesta> autenticacion(AutenticacionException e) {
        Codigo c = e.getCodigo();
        return ResponseEntity.status(c.estado()).body(new ErrorRespuesta(c.name(), c.mensaje()));
    }

    /** Cuerpo ausente, mal formado o con campos vacios/demasiado largos. No se detalla el motivo. */
    @ExceptionHandler({MethodArgumentNotValidException.class, HttpMessageNotReadableException.class})
    public ResponseEntity<ErrorRespuesta> solicitudInvalida(Exception e) {
        Codigo c = Codigo.CREDENCIALES_INVALIDAS;
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(new ErrorRespuesta(c.name(), c.mensaje()));
    }

    /** Cualquier otro fallo: respuesta generica; en el log solo el tipo de excepcion, nunca el cuerpo de la peticion. */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorRespuesta> inesperado(Exception e) {
        LOG.error("Error inesperado en la API de autenticación: {}", e.getClass().getName());
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ErrorRespuesta("DESCONOCIDO", "No se pudo completar la operación. Inténtalo nuevamente."));
    }
}
