import { BRAND } from '@/lib/config';
import { fecha } from '@/lib/dates';
import { CFG } from '@/lib/config';

/** Solo visible al imprimir: identifica el documento. */
export function PrintHeader({ titulo, lineas }: { titulo: string; lineas: string[] }) {
  return (
    <div className="print-only mb-4 border-b border-black pb-3">
      <p className="text-sm font-semibold">{BRAND.nombre} <span className="font-normal">· {BRAND.descriptor}</span></p>
      <p className="text-xs">Documento de demostración</p>
      <h2 className="mt-1 text-lg font-semibold">{titulo}</h2>
      {lineas.map((l) => <p key={l} className="text-xs">{l}</p>)}
      <p className="text-xs">Emitido el {fecha(CFG.hoy)} · Datos ficticios, sin validez contractual.</p>
    </div>
  );
}
