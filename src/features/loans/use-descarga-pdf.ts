import { useRef, useState } from 'react';
import { toast } from '@/components/ui/toast';
import { descargarPdf, type DatosPdf } from '@/lib/pdf';

/** Descarga un PDF en el navegador con estado de carga y aviso. Ignora clics mientras se genera. */
export function useDescargaPdf() {
  const [generando, setGenerando] = useState(false);
  const enCurso = useRef(false);
  const descargar = async (datos: DatosPdf) => {
    if (enCurso.current) return;
    enCurso.current = true;
    setGenerando(true);
    try {
      await descargarPdf(datos);
      toast.success('PDF descargado');
    } catch {
      toast.error('No se pudo generar el PDF. Inténtalo de nuevo.');
    } finally {
      enCurso.current = false;
      setGenerando(false);
    }
  };
  return { generando, descargar };
}
