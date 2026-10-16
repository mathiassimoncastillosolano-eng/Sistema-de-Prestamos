import { zodResolver } from '@hookform/resolvers/zod';
import { Check, Search, ShieldAlert } from 'lucide-react';
import { useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { DefinitionList } from '@/components/data-display/definition-list';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Segmented } from '@/components/ui/segmented';
import { Sheet } from '@/components/ui/sheet';
import { toast } from '@/components/ui/toast';
import { useIdentidad } from '@/hooks/use-auth';
import { TIPOS_CLIENTE, clienteSchema, clienteVacio, esDocumentoValido, type ClienteForm } from '@/lib/validation';
import { delay } from '@/lib/utils';
import { registrarCliente } from '@/services/actions';
import { EJEMPLOS_CONSULTA, consultarDni, consultarRuc, esEmpresaMock } from '@/services/identity';
import { getDb } from '@/services/store';
import type { Cliente, TipoCliente } from '@/types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Si se indica, no se navega al expediente: se devuelve el cliente creado (p. ej. desde la solicitud). */
  onCreated?: (c: Cliente) => void;
}

const Seccion = ({ titulo, children }: { titulo: string; children: React.ReactNode }) => {
  const id = useId();
  return (
    <section aria-labelledby={id} className="space-y-4 border-b border-line px-5 py-5 last:border-0">
      <h3 id={id} className="text-sm font-semibold text-ink">{titulo}</h3>
      {children}
    </section>
  );
};

type Estado = { tipo: 'idle' | 'cargando' | 'ok' | 'sin-datos' | 'invalido'; texto?: string };

export function ClientFormSheet({ open, onOpenChange, onCreated }: Props) {
  const navigate = useNavigate();
  const [consulta, setConsulta] = useState<Estado>({ tipo: 'idle' });
  const yo = useIdentidad();
  const [confirmar, setConfirmar] = useState<ClienteForm | null>(null);
  const [guardando, setGuardando] = useState(false);

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<ClienteForm>({
    // El esquema se reconstruye en cada validación para ver siempre los documentos ya registrados
    resolver: (values, ctx, opts) => zodResolver(clienteSchema(getDb().clientes.map((c) => c.doc)))(values, ctx, opts),
    defaultValues: clienteVacio(), mode: 'onTouched', reValidateMode: 'onChange'
  });
  const tipo = watch('tipo');
  const doc = watch('doc');

  const cambiarTipo = (t: TipoCliente) => { reset(clienteVacio(t)); setConsulta({ tipo: 'idle' }); };
  const cerrar = (o: boolean) => { onOpenChange(o); if (!o) { reset(clienteVacio()); setConsulta({ tipo: 'idle' }); } };

  const consultar = async () => {
    if (!esDocumentoValido(tipo, doc.trim())) { setConsulta({ tipo: 'invalido', texto: 'Revisa el número: el DNI tiene 8 dígitos y el RUC 11 (10… o 20…).' }); return; }
    setConsulta({ tipo: 'cargando', texto: 'Consultando datos de demostración…' });
    const sv = (k: keyof ClienteForm, v: string) => setValue(k, v, { shouldValidate: true, shouldDirty: true });
    if (tipo === 'DNI') {
      const nombre = await consultarDni(doc.trim());
      if (!nombre) { setConsulta({ tipo: 'sin-datos' }); return; }
      sv('nombre', nombre);
    } else {
      const r = await consultarRuc(doc.trim());
      if (!r) { setConsulta({ tipo: 'sin-datos' }); return; }
      if (esEmpresaMock(r)) { sv('nombre', r.razon); sv('repNombre', r.rep); sv('repDni', r.repDni); sv('domicilio', r.domicilio); }
      else { sv('nombre', r.titular); sv('dniTitular', r.dni); sv('negocio', r.negocio); }
    }
    setConsulta({ tipo: 'ok' });
  };

  const guardar = async (v: ClienteForm) => {
    setGuardando(true);
    await delay(450); // simula la latencia de un servicio
    const r = registrarCliente(yo, {
      nombre: v.nombre, tipo: v.tipo, doc: v.doc, telefono: v.telefono,
      ...(v.tipo === 'RUC 10' ? { negocio: v.negocio, dniTitular: v.dniTitular } : {}),
      ...(v.tipo === 'RUC 20' ? { domicilio: v.domicilio, representante: { nombre: v.repNombre, dni: v.repDni } } : {})
    });
    setGuardando(false);
    if (!r.ok) { toast.error(r.error); setConfirmar(null); return; }
    toast.success(`Cliente registrado: ${r.cliente.nombre}`);
    setConfirmar(null);
    cerrar(false);
    if (onCreated) onCreated(r.cliente); else navigate(`/clientes/${r.cliente.id}`);
  };

  const dniLen = tipo === 'DNI' ? 8 : 11;
  const nombreLabel = tipo === 'RUC 20' ? 'Razón social' : tipo === 'RUC 10' ? 'Nombre del titular' : 'Nombres y apellidos';

  return (
    <>
      <Sheet open={open} onOpenChange={cerrar} title="Registrar cliente" description="Persona natural, persona con negocio o persona jurídica."
        footer={<><Button variant="secondary" onClick={() => cerrar(false)}>Cancelar</Button><Button variant="primary" type="submit" form="form-cliente">Revisar y registrar</Button></>}>
        <form id="form-cliente" noValidate onSubmit={handleSubmit((v) => setConfirmar(v))}>
          <Seccion titulo="Tipo de cliente">
            <Segmented aria-label="Tipo de cliente" value={tipo} onValueChange={cambiarTipo} options={TIPOS_CLIENTE} fill />
          </Seccion>

          <Seccion titulo="Identificación">
            <div className="flex items-start gap-3 rounded-control bg-info-soft p-3 text-[0.8125rem] text-info-ink">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <p>Consulta <b className="font-semibold">simulada</b> con datos locales. No se conecta con RENIEC, SUNAT ni servicios de identidad reales.</p>
            </div>
            <Field label={tipo === 'DNI' ? 'DNI' : `RUC (inicia con ${tipo === 'RUC 10' ? '10' : '20'})`} error={errors.doc?.message} hint={<span className="num">{doc.length}/{dniLen} dígitos</span>}>
              <Input inputMode="numeric" maxLength={dniLen} placeholder={`${dniLen} dígitos`} autoComplete="off" {...register('doc', { onChange: () => setConsulta({ tipo: 'idle' }) })} />
            </Field>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm" onClick={consultar} loading={consulta.tipo === 'cargando'}><Search className="size-4" />Consultar (simulado)</Button>
              <p role="status" className="text-[0.8125rem] text-ink-muted">
                {consulta.tipo === 'idle' && <>Prueba con {EJEMPLOS_CONSULTA[tipo]} (datos ficticios).</>}
                {consulta.tipo === 'cargando' && consulta.texto}
                {consulta.tipo === 'invalido' && <span className="font-medium text-danger-ink">{consulta.texto}</span>}
                {consulta.tipo === 'sin-datos' && 'Sin coincidencia en los datos simulados. Completa los campos manualmente.'}
                {consulta.tipo === 'ok' && <span className="inline-flex items-center gap-1 font-medium text-success-ink"><Check className="size-3.5" aria-hidden />Datos simulados cargados. Verifícalos antes de registrar.</span>}
              </p>
            </div>
          </Seccion>

          <Seccion titulo={tipo === 'RUC 20' ? 'Empresa' : 'Datos del cliente'}>
            <Field label={nombreLabel} error={errors.nombre?.message}><Input autoComplete="off" {...register('nombre')} /></Field>
            {tipo === 'RUC 10' && (
              <>
                <Field label="DNI del titular" error={errors.dniTitular?.message}><Input inputMode="numeric" maxLength={8} placeholder="8 dígitos" {...register('dniTitular')} /></Field>
                <Field label="Actividad del negocio" error={errors.negocio?.message}><Input {...register('negocio')} /></Field>
              </>
            )}
            {tipo === 'RUC 20' && <Field label="Domicilio fiscal" error={errors.domicilio?.message}><Input {...register('domicilio')} /></Field>}
          </Seccion>

          {tipo === 'RUC 20' && (
            <Seccion titulo="Representante legal">
              <Field label="Nombre del representante" error={errors.repNombre?.message}><Input autoComplete="off" {...register('repNombre')} /></Field>
              <Field label="DNI del representante" error={errors.repDni?.message}><Input inputMode="numeric" maxLength={8} placeholder="8 dígitos" {...register('repDni')} /></Field>
            </Seccion>
          )}

          <Seccion titulo="Contacto">
            <Field label="Celular" optional error={errors.telefono?.message}><Input inputMode="numeric" maxLength={9} placeholder="9XXXXXXXX" autoComplete="off" {...register('telefono')} /></Field>
          </Seccion>
        </form>
      </Sheet>

      <Modal open={!!confirmar} onOpenChange={(o) => { if (!o && !guardando) setConfirmar(null); }} title="Confirmar registro" description="Se creará un expediente con un identificador único."
        footer={<><Button variant="secondary" onClick={() => setConfirmar(null)} disabled={guardando}>Volver</Button><Button variant="primary" loading={guardando} onClick={() => confirmar && guardar(confirmar)}>Confirmar registro</Button></>}>
        {confirmar && (
          <DefinitionList items={[
            { label: 'Tipo', value: <Badge tone="teal">{confirmar.tipo}</Badge> },
            { label: 'Documento', value: confirmar.doc },
            { label: confirmar.tipo === 'RUC 20' ? 'Razón social' : 'Nombre', value: confirmar.nombre },
            ...(confirmar.tipo === 'RUC 20' ? [{ label: 'Representante', value: `${confirmar.repNombre} · DNI ${confirmar.repDni}` }] : []),
            { label: 'Agencia', value: yo.agencia }
          ]} />
        )}
      </Modal>
    </>
  );
}
