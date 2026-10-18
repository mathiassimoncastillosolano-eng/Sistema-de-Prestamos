import { SearchX } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout/page-header';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { consultarCliente, type ClienteDetalle } from '@/services/clientes-api';

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs text-ink-muted">{etiqueta}</dt>
      <dd className="mt-1 break-words text-sm font-medium text-ink">{valor || 'No registrado'}</dd>
    </div>
  );
}

export default function ClientDetailPage() {
  const { id } = useParams();
  const [cliente, setCliente] = useState<ClienteDetalle | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    if (!id) {
      setCliente(null);
      setCargando(false);
      return;
    }

    let activo = true;
    setCargando(true);
    setError(null);
    consultarCliente(id)
      .then((datos) => { if (activo) setCliente(datos); })
      .catch((fallo: unknown) => {
        if (activo) setError(fallo instanceof Error ? fallo.message : 'No se pudo consultar el cliente.');
      })
      .finally(() => { if (activo) setCargando(false); });
    return () => { activo = false; };
  }, [id, intento]);

  if (cargando) {
    return <Card className="p-5" role="status">Cargando cliente...</Card>;
  }

  if (error) {
    return (
      <Card className="space-y-3 p-5" role="alert">
        <p>{error}</p>
        <Button onClick={() => setIntento((valor) => valor + 1)}>Reintentar</Button>
      </Card>
    );
  }

  if (!cliente) {
    return <EmptyState icon={SearchX} title="Cliente no encontrado" description="El cliente solicitado no existe." action={<Button asChild variant="primary"><Link to="/clientes">Volver al listado</Link></Button>} />;
  }

  return (
    <>
      <PageHeader
        back={{ to: '/clientes', label: 'Clientes' }}
        title={cliente.nombre}
        description={`${cliente.tipoDocumento} ${cliente.numeroDocumento}`}
      />

      <Card>
        <div className="flex items-center gap-4 border-b border-line p-5">
          <Avatar nombre={cliente.nombre} tipo={cliente.tipoDocumento} size="xl" />
          <div>
            <h2 className="font-semibold text-ink">Datos del cliente</h2>
            <Badge tone="neutral">{cliente.tipoDocumento}</Badge>
          </div>
        </div>

        <div className="p-5">
          <h3 className="mb-4 text-sm font-semibold text-ink">Datos generales</h3>
          <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Dato etiqueta="Código de cliente" valor={String(cliente.numero)} />
            <Dato etiqueta={cliente.tipoDocumento === 'RUC 20' ? 'Razón social' : 'Nombre completo'} valor={cliente.nombre} />
            <Dato etiqueta="Tipo de documento" valor={cliente.tipoDocumento} />
            <Dato etiqueta="Número de documento" valor={cliente.numeroDocumento} />
            <Dato etiqueta="Teléfono" valor={cliente.telefono} />
            <Dato etiqueta="Correo electrónico" valor={cliente.correo} />
            <Dato etiqueta="Fecha de registro" valor={new Date(cliente.creadoEn).toLocaleDateString('es-PE')} />
            <Dato etiqueta="ID de agencia" valor={cliente.agenciaId} />
          </dl>
        </div>

        {cliente.tipoDocumento === 'RUC 10' && (
          <div className="border-t border-line p-5">
            <h3 className="mb-4 text-sm font-semibold text-ink">Datos de RUC 10</h3>
            <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Dato etiqueta="DNI del titular" valor={cliente.dniTitular} />
              <Dato etiqueta="Estado SUNAT" valor={cliente.estadoSunat} />
              <Dato etiqueta="Condición SUNAT" valor={cliente.condicionSunat} />
            </dl>
          </div>
        )}

        {cliente.tipoDocumento === 'RUC 20' && (
          <div className="border-t border-line p-5">
            <h3 className="mb-4 text-sm font-semibold text-ink">Datos de RUC 20</h3>
            <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Dato etiqueta="Domicilio" valor={cliente.domicilio} />
              <Dato etiqueta="Nombre del representante" valor={cliente.representanteNombre} />
              <Dato etiqueta="DNI del representante" valor={cliente.representanteDni} />
              <Dato etiqueta="Estado SUNAT" valor={cliente.estadoSunat} />
              <Dato etiqueta="Condición SUNAT" valor={cliente.condicionSunat} />
            </dl>
          </div>
        )}
      </Card>
    </>
  );
}
