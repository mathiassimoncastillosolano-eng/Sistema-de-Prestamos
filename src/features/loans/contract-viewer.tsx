import { FileDown } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { generarPdfContrato } from '@/lib/pdf-contrato';
import type { ContratoApi } from '@/services/prestamos-api';
import { useDescargaContrato } from './use-contrato';

/**
 * Vista previa del contrato: el mismo PDF que se descarga, mostrado en el visor del navegador.
 * El PDF vive en una URL de blob local (no es un enlace público ni se sube a ningún sitio) y se libera al cerrar.
 */
export function ContractViewerModal({ contrato, onClose }: { contrato: ContratoApi | null; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { generando, descargar } = useDescargaContrato();

  useEffect(() => {
    if (!contrato) { setUrl(null); setError(null); return; }
    let vigente = true;
    let creada: string | null = null;
    setUrl(null);
    setError(null);
    generarPdfContrato(contrato)
      .then((blob) => {
        if (!vigente) return;
        creada = URL.createObjectURL(blob);
        setUrl(creada);
      })
      .catch((e: unknown) => { if (vigente) setError(e instanceof Error ? e.message : 'No se pudo generar el contrato.'); });
    return () => { vigente = false; if (creada) URL.revokeObjectURL(creada); };
  }, [contrato]);

  const borrador = contrato?.estado === 'BORRADOR';
  return (
    <Modal open={!!contrato} onOpenChange={(o) => { if (!o) onClose(); }} size="xl"
      title={borrador ? 'Contrato (borrador)' : `Contrato ${contrato?.codigo ?? ''}`}
      description={borrador ? 'Borrador para revisión: el préstamo aún no está registrado.' : undefined}
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cerrar</Button>
        {contrato && <Button onClick={() => void descargar(contrato)} loading={generando}><FileDown className="size-4" aria-hidden />{borrador ? 'Descargar borrador PDF' : 'Descargar contrato PDF'}</Button>}
      </>}>
      {error
        ? <p role="alert" className="rounded-control bg-danger-soft px-3 py-2.5 text-sm text-danger-ink">{error}</p>
        : url
          ? <iframe title="Vista previa del contrato" src={url} className="h-[70dvh] w-full rounded-control border border-line bg-surface-2" />
          : <p role="status" className="py-10 text-center text-sm text-ink-muted">Preparando el contrato…</p>}
    </Modal>
  );
}
