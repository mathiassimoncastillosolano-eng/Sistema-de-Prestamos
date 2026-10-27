package com.nexora.backend.caja.controladores;

import com.nexora.backend.caja.excepciones.CajaException;
import com.nexora.backend.prestamos.dto.ErrorPrestamoRespuesta;
import com.nexora.backend.prestamos.excepciones.PrestamoException;
import java.util.Map;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

/** Mismo formato de error que el módulo de préstamos: { codigo, mensaje, detalle }. */
@RestControllerAdvice(assignableTypes = { CajaControlador.class, ReposicionControlador.class, SupervisionCajaControlador.class })
@Order(Ordered.HIGHEST_PRECEDENCE)
public class ManejadorErroresCaja {
    private static final org.slf4j.Logger LOG = org.slf4j.LoggerFactory.getLogger(ManejadorErroresCaja.class);


    @ExceptionHandler(CajaException.class)
    public ResponseEntity<ErrorPrestamoRespuesta> caja(CajaException ex) {
        Map<String, Object> detalle = ex.getDetalle() == null ? Map.of() : ex.getDetalle();
        return ResponseEntity.status(ex.getCodigo().estado())
                .body(new ErrorPrestamoRespuesta(ex.getCodigo().name(), ex.getMessage(), detalle));
    }

    @ExceptionHandler(PrestamoException.class)
    public ResponseEntity<ErrorPrestamoRespuesta> prestamo(PrestamoException ex) {
        return ResponseEntity.status(ex.getCodigo().estado())
                .body(new ErrorPrestamoRespuesta(ex.getCodigo().name(), ex.getMessage(),
                        ex.getDetalle() == null ? Map.of() : ex.getDetalle()));
    }

    /** Un fallo de base de datos (p. ej. serialización 40001) no debe filtrar SQL ni detalles internos. */
    @ExceptionHandler(DataAccessException.class)
    public ResponseEntity<ErrorPrestamoRespuesta> baseDeDatos(DataAccessException ex) {
        LOG.warn("Fallo de base de datos en el módulo de caja: {}", ex.getMostSpecificCause().getMessage());
        return ResponseEntity.status(HttpStatus.CONFLICT).body(new ErrorPrestamoRespuesta(
                "CONFLICTO_CONCURRENCIA",
                "La operación no se pudo completar porque otra se interpuso. No se guardó nada; actualiza e inténtalo de nuevo.",
                Map.of()));
    }

    @ExceptionHandler({ HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class })
    public ResponseEntity<ErrorPrestamoRespuesta> entradaInvalida(Exception ex) {
        return ResponseEntity.badRequest().body(new ErrorPrestamoRespuesta(
                "DATOS_INVALIDOS", "Los datos enviados no son válidos: revisa los importes, las fechas y los identificadores.",
                Map.of()));
    }

    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    public ResponseEntity<ErrorPrestamoRespuesta> tipoNoSoportado(HttpMediaTypeNotSupportedException ex) {
        return ResponseEntity.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE).body(new ErrorPrestamoRespuesta(
                "DATOS_INVALIDOS", "La solicitud debe enviarse como application/json.", Map.of()));
    }
}
