import { useCallback, useEffect, useState } from 'react';
import { prestamosApi, PrestamoApiError, type ContratoApi, type SolicitudPrestamoApi } from '@/services/prestamos-api';

interface Resultado {
  clave: string;
  contrato: ContratoApi | null;
  error: PrestamoApiError | null;
}

/**
 * Borrador del contrato para la confirmación. El servidor lo arma con las mismas validaciones y el mismo cronograma que el
 * registro, pero no guarda nada. Se pide de nuevo cada vez que cambia algo de lo revisado (cliente, monto, plazo,
 * observaciones, fecha de desembolso o total): nunca se muestra el borrador de otras condiciones.
 */
export function useContratoBorrador(solicitud: SolicitudPrestamoApi | null) {
  const clave = solicitud
    ? [solicitud.clienteId, solicitud.capital, solicitud.plazoMeses, solicitud.observaciones ?? '', solicitud.fechaDesembolsoEsperada ?? '', solicitud.totalContractualEsperado ?? ''].join('|')
    : null;
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    if (!solicitud || !clave) return;
    let vigente = true;
    prestamosApi.contratoPreliminar(solicitud)
      .then((contrato) => { if (vigente) setResultado({ clave, contrato, error: null }); })
      .catch((e: unknown) => {
        if (vigente) setResultado({ clave, contrato: null, error: e instanceof PrestamoApiError ? e : new PrestamoApiError('DESCONOCIDO', 'No se pudo preparar el contrato.') });
      });
    return () => { vigente = false; };
    // La solicitud completa está representada por su clave.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, intento]);

  const reintentar = useCallback(() => { setResultado(null); setIntento((n) => n + 1); }, []);
  const actual = clave && resultado?.clave === clave ? resultado : null;
  return {
    contrato: actual?.contrato ?? null,
    error: actual?.error ?? null,
    cargando: !!clave && !actual,
    reintentar
  };
}
