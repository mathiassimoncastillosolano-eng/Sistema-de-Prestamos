import { useRef, useState } from 'react';
import { toast } from '@/components/ui/toast';
import { descargarPdf } from '@/lib/pdf';
import { descargarPdfContrato } from '@/lib/pdf-contrato';
import { PrestamoApiError, prestamosApi, type ContratoApi } from '@/services/prestamos-api';
import { datosPdfRegistrado } from './pdf-datos';

const mensaje = (e: unknown, defecto: string) => (e instanceof Error && e.message ? e.message : defecto);

/** Descarga el PDF de un contrato ya cargado (borrador o definitivo). Independiente del PDF del cronograma. */
export function useDescargaContrato() {
  const [generando, setGenerando] = useState(false);
  const enCurso = useRef(false);
  const descargar = async (contrato: ContratoApi) => {
    if (enCurso.current) return;
    enCurso.current = true;
    setGenerando(true);
    try {
      await descargarPdfContrato(contrato);
      toast.success(contrato.estado === 'BORRADOR' ? 'Borrador descargado' : 'Contrato descargado');
    } catch (e) {
      toast.error(mensaje(e, 'No se pudo generar el contrato. Inténtalo de nuevo.'));
    } finally {
      enCurso.current = false;
      setGenerando(false);
    }
  };
  return { generando, descargar };
}

/**
 * Acciones de un préstamo registrado por id (listado y detalle): cronograma PDF, ver contrato y contrato PDF.
 * Cada acción pide al servidor lo suyo (el contrato guardado o el detalle) y falla con un mensaje claro, sin afectar a las otras.
 */
export function useAccionesPrestamo() {
  const [ocupado, setOcupado] = useState<{ id: string; cual: 'cronograma' | 'ver' | 'contrato' } | null>(null);
  const [contratoVisible, setContratoVisible] = useState<ContratoApi | null>(null);
  const enCurso = useRef(false);

  const ejecutar = async (id: string, cual: 'cronograma' | 'ver' | 'contrato', trabajo: () => Promise<void>) => {
    if (enCurso.current) return;
    enCurso.current = true;
    setOcupado({ id, cual });
    try { await trabajo(); } finally { enCurso.current = false; setOcupado(null); }
  };

  const cronograma = (id: string) => ejecutar(id, 'cronograma', async () => {
    try {
      await descargarPdf(datosPdfRegistrado(await prestamosApi.consultar(id)));
      toast.success('Cronograma descargado');
    } catch (e) { toast.error(e instanceof PrestamoApiError ? e.message : 'No se pudo generar el cronograma. Inténtalo de nuevo.'); }
  });
  const verContrato = (id: string) => ejecutar(id, 'ver', async () => {
    try { setContratoVisible(await prestamosApi.contrato(id)); }
    catch (e) { toast.error(mensaje(e, 'No se pudo cargar el contrato.')); }
  });
  const descargarContrato = (id: string) => ejecutar(id, 'contrato', async () => {
    try { await descargarPdfContrato(await prestamosApi.contrato(id)); toast.success('Contrato descargado'); }
    catch (e) { toast.error(mensaje(e, 'No se pudo generar el contrato. Inténtalo de nuevo.')); }
  });

  return { ocupado, contratoVisible, cerrarContrato: () => setContratoVisible(null), cronograma, verContrato, descargarContrato };
}
