package com.nexora.backend.prestamos.controladores;

import com.nexora.backend.prestamos.dto.ErrorPrestamoRespuesta;
import com.nexora.backend.prestamos.excepciones.PrestamoException;
import java.util.Map;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@RestControllerAdvice(assignableTypes = PrestamoControlador.class)
@Order(Ordered.HIGHEST_PRECEDENCE)
public class ManejadorErroresPrestamo {

    @ExceptionHandler(PrestamoException.class)
    public ResponseEntity<ErrorPrestamoRespuesta> prestamo(PrestamoException ex) {
        Map<String, Object> detalle = ex.getDetalle() == null ? Map.of() : ex.getDetalle();
        return ResponseEntity.status(ex.getCodigo().estado())
                .body(new ErrorPrestamoRespuesta(ex.getCodigo().name(), ex.getMessage(), detalle));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ErrorPrestamoRespuesta> jsonInvalido(HttpMessageNotReadableException ex) {
        return ResponseEntity.badRequest().body(new ErrorPrestamoRespuesta(
                "DATOS_INVALIDOS",
                "El cuerpo de la solicitud no es válido: revise que capital y plazo sean numéricos.",
                Map.of()));
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ErrorPrestamoRespuesta> parametroInvalido(MethodArgumentTypeMismatchException ex) {
        return ResponseEntity.badRequest().body(new ErrorPrestamoRespuesta(
                "DATOS_INVALIDOS",
                "El identificador indicado no es válido.",
                Map.of()));
    }

    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    public ResponseEntity<ErrorPrestamoRespuesta> tipoNoSoportado(HttpMediaTypeNotSupportedException ex) {
        return ResponseEntity.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE).body(new ErrorPrestamoRespuesta(
                "DATOS_INVALIDOS",
                "La solicitud debe enviarse como application/json.",
                Map.of()));
    }
}