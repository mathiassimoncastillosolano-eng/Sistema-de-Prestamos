package com.nexora.backend.prestamos.controladores;

import com.nexora.backend.prestamos.dto.ErrorPrestamoRespuesta;
import com.nexora.backend.prestamos.excepciones.PrestamoException;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

@RestControllerAdvice(assignableTypes = PrestamoControlador.class)
@Order(Ordered.HIGHEST_PRECEDENCE)
public class ManejadorErroresPrestamo {

    @ExceptionHandler(PrestamoException.class)
    public ResponseEntity<ErrorPrestamoRespuesta> prestamo(PrestamoException ex) {
        HttpStatus status = switch (ex.getCodigo()) {
            case DATOS_INVALIDOS -> HttpStatus.BAD_REQUEST;
            case SIN_PERMISO -> HttpStatus.FORBIDDEN;
            case CLIENTE_NO_ENCONTRADO -> HttpStatus.NOT_FOUND;
            case CLIENTE_NO_APTO,
                 CAPITAL_BAJO_MINIMO,
                 PLAZO_FUERA_DE_RANGO,
                 MONEDA_NO_PERMITIDA,
                 LIMITE_EXCEDIDO -> HttpStatus.UNPROCESSABLE_ENTITY;
        };
        Map<String, Object> detalle = ex.getDetalle() == null ? Map.of() : ex.getDetalle();
        return ResponseEntity.status(status)
                .body(new ErrorPrestamoRespuesta(ex.getCodigo().name(), ex.getMessage(), detalle));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ErrorPrestamoRespuesta> jsonInvalido(HttpMessageNotReadableException ex) {
        return ResponseEntity.badRequest().body(new ErrorPrestamoRespuesta(
                "DATOS_INVALIDOS",
                "El cuerpo de la solicitud no es válido: revise que capital y plazo sean numéricos.",
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