import { Download, EllipsisVertical, Eye, FileDown, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownContent, DropdownItem, DropdownMenu, DropdownTrigger } from '@/components/ui/dropdown';
import { ContractViewerModal } from './contract-viewer';
import { codigoPrestamo } from './loan-utils';
import { useAccionesPrestamo } from './use-contrato';

type Acciones = ReturnType<typeof useAccionesPrestamo>;

/** Menú «Acciones» de una fila del listado. Detiene la propagación: abrirlo no navega al detalle del préstamo. */
export function MenuAccionesPrestamo({ id, numero, acciones }: { id: string; numero: number; acciones: Acciones }) {
  const codigo = codigoPrestamo(numero);
  const parar = (e: { stopPropagation: () => void }) => e.stopPropagation();
  return (
    <div onClick={parar} onKeyDown={parar} className="flex justify-end">
      <DropdownMenu>
        <DropdownTrigger asChild>
          <Button variant="ghost" size="sm" aria-label={`Acciones del préstamo ${codigo}`} loading={acciones.ocupado?.id === id}><EllipsisVertical className="size-4" aria-hidden /></Button>
        </DropdownTrigger>
        <DropdownContent>
          <DropdownItem onSelect={() => void acciones.cronograma(id)}><FileDown className="size-4" aria-hidden />Descargar cronograma PDF</DropdownItem>
          <DropdownItem onSelect={() => void acciones.verContrato(id)}><Eye className="size-4" aria-hidden />Ver contrato</DropdownItem>
          <DropdownItem onSelect={() => void acciones.descargarContrato(id)}><Download className="size-4" aria-hidden />Descargar contrato PDF</DropdownItem>
        </DropdownContent>
      </DropdownMenu>
    </div>
  );
}

/** Botones del contrato en el detalle del préstamo (junto a «Descargar cronograma PDF»). */
export function BotonesContrato({ id, acciones }: { id: string; acciones: Acciones }) {
  return (
    <>
      <Button onClick={() => void acciones.verContrato(id)} loading={acciones.ocupado?.id === id && acciones.ocupado.cual === 'ver'}><FileText className="size-4" aria-hidden />Ver contrato</Button>
      <Button onClick={() => void acciones.descargarContrato(id)} loading={acciones.ocupado?.id === id && acciones.ocupado.cual === 'contrato'}><Download className="size-4" aria-hidden />Descargar contrato PDF</Button>
    </>
  );
}

export function VisorContratoPrestamo({ acciones }: { acciones: Acciones }) {
  return <ContractViewerModal contrato={acciones.contratoVisible} onClose={acciones.cerrarContrato} />;
}
