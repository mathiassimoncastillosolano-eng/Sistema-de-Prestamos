import { TriangleAlert } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { DefinitionList } from '@/components/data-display/definition-list';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { fecha } from '@/lib/dates';
import { money } from '@/lib/format';
import { consultarCliente, type ClienteDetalle } from '@/services/clientes-api';
import { prestamosApi, PrestamoApiError, type PrestamoApi } from '@/services/prestamos-api';
import { aCuotas } from '@/services/prestamos-adapter';
import { ScheduleTable } from './schedule-table';

/** Préstamo registrado en el sistema real (US-06): todo viene del servidor, nada se recalcula aquí. */
export function RealLoanDetail({ id }: { id: string }) {
  const [prestamo, setPrestamo] = useState<PrestamoApi | null>(null);
  const [cliente, setCliente] = useState<ClienteDetalle | null>(null);
  const [error, setError] = useState<PrestamoApiError | null>(null);
  const [cargando, setCargando] = useState(true);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError(null);
    prestamosApi
      .consultar(id)
      .then(async (p) => {
        if (!vigente) return;
        setPrestamo(p);
        try {
          const c = await consultarCliente(p.clienteId);
          if (vigente) setCliente(c);
        } catch {
          /* el nombre del cliente es opcional */
        }
      })
      .catch((e: unknown) => {
        if (!vigente) return;
        setError(e instanceof PrestamoApiError ? e : new PrestamoApiError('DESCONOCIDO', 'No se pudo cargar el préstamo.'));
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });
    return () => {
      vigente = false;
    };
  }, [id, intento]);

  const cuotas = useMemo(() => (prestamo ? aCuotas(prestamo.cuotas) : []), [prestamo]);

  if (cargando) return <p role="status" className="py-10 text-center text-sm text-ink-muted">Cargando préstamo…</p>;

  if (error || !prestamo) {
    const noExiste = error?.codigo === 'PRESTAMO_NO_ENCONTRADO';
    return (
      <EmptyState
        icon={TriangleAlert}
        title={noExiste ? 'Préstamo no encontrado' : 'No se pudo cargar el préstamo'}
        description={noExiste ? 'Revisa el código o vuelve al listado de préstamos.' : error?.message ?? 'Inténtalo nuevamente.'}
        action={
          noExiste
            ? <Button asChild variant="primary"><Link to="/prestamos">Ver préstamos</Link></Button>
            : <Button variant="primary" onClick={() => setIntento((n) => n + 1)}>Reintentar</Button>
        }
      />
    );
  }

  const kpis = [
    { label: 'Capital original', valor: prestamo.capital, pie: 'Monto registrado' },
    { label: 'Cuota mensual', valor: prestamo.cuotaMensual, pie: `${prestamo.plazoMeses} cuotas` },
    { label: 'Intereses pactados', valor: prestamo.totalIntereses, pie: `TEA ${(prestamo.tea * 100).toFixed(0)} %` },
    { label: 'Importe contractual total', valor: prestamo.totalContractual, pie: 'Capital + intereses' }
  ];
  const ultima = prestamo.cuotas[prestamo.cuotas.length - 1];

  return (
    <>
      <PageHeader
        back={{ to: '/prestamos', label: 'Préstamos' }}
        title={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            Préstamo N.º {prestamo.numero}
            <span className="rounded-full bg-success-soft px-2.5 py-0.5 text-[0.8125rem] font-medium text-success-ink">
              {prestamo.estado === 'activo' ? 'Activo' : 'Cerrado'}
            </span>
          </span>
        }
        description={
          cliente
            ? <Link to={`/clientes/${cliente.id}`} className="font-medium text-teal-ink hover:underline">{cliente.nombre}</Link>
            : undefined
        }
      />

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line shadow-card lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="bg-surface p-4 sm:p-5">
            <p className="text-[0.8125rem] text-ink-muted">{k.label}</p>
            <p className="num mt-1 truncate text-xl font-semibold text-ink">{money(k.valor)}</p>
            <p className="mt-1 text-xs text-ink-muted">{k.pie}</p>
          </div>
        ))}
      </div>

      <Card className="mt-5">
        <CardHeader title="Condiciones" className="pb-2" />
        <CardBody className="pt-0">
          <DefinitionList
            items={[
              { label: 'Moneda', value: 'Soles (PEN)' },
              { label: 'Fecha de desembolso', value: fecha(prestamo.fechaDesembolso) },
              { label: 'Primer vencimiento', value: fecha(prestamo.fechaPrimerVencimiento) },
              { label: 'Vencimiento final', value: ultima ? fecha(ultima.fechaVencimiento) : '—' },
              { label: 'Plazo', value: `${prestamo.plazoMeses} meses` },
              { label: 'TEA', value: `${(prestamo.tea * 100).toFixed(0)} %` }
            ]}
          />
        </CardBody>
      </Card>

      <Card className="mt-5 overflow-hidden">
        <CardHeader title="Cronograma de cuotas" description={`${prestamo.plazoMeses} cuotas mensuales iguales`} className="pb-4" />
        <ScheduleTable prestamo={{ cronograma: cuotas, capital: prestamo.capital }} proyectado />      </Card>
    </>
  );
}