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
import { ClientesApiError, clientesApi, type ClienteRegistrado, type ConsultaDocumento } from '@/services/clientes-api';
import type { TipoCliente } from '@/types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

/** Campos que completa la consulta a API PERÚ (solo lectura en el formulario). */
const CAMPOS_CONSULTA = ['nombre', 'dniTitular', 'domicilio', 'repNombre', 'repDni', 'estadoSunat', 'condicionSunat'] as const;

const MENSAJE_OK: Record<TipoCliente, string> = {
  DNI: 'Nombre obtenido de RENIEC.',
  'RUC 10': 'Datos obtenidos de SUNAT. DNI del titular verificado.',
  'RUC 20': 'Datos obtenidos de SUNAT.'
};

export function ClientFormSheet({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const [consulta, setConsulta] = useState<Estado>({ tipo: 'idle' });
  const yo = useIdentidad();
  const [confirmar, setConfirmar] = useState<ClienteForm | null>(null);
  const [guardando, setGuardando] = useState(false);
  /** Última consulta válida. Solo con ella (y para el mismo documento) se puede registrar. */
  const [datos, setDatos] = useState<ConsultaDocumento | null>(null);

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<ClienteForm>({
    resolver: zodResolver(clienteSchema),
    defaultValues: clienteVacio(), mode: 'onTouched', reValidateMode: 'onChange'
  });
  const tipo = watch('tipo');
  const doc = watch('doc');

  const cambiarTipo = (t: TipoCliente) => { reset(clienteVacio(t)); setConsulta({ tipo: 'idle' }); setDatos(null); };
  const cerrar = (o: boolean) => { onOpenChange(o); if (!o) { reset(clienteVacio()); setConsulta({ tipo: 'idle' }); setDatos(null); } };

  /** Al cambiar el documento, los datos consultados dejan de valer. */
  const limpiarConsulta = () => {
    setConsulta({ tipo: 'idle' });
    if (!datos) return;
    setDatos(null);
    CAMPOS_CONSULTA.forEach((k) => setValue(k, ''));
  };


  const consultar = async () => {
    const documento = doc.trim();

    if (!esDocumentoValido(tipo, documento)) {
      setConsulta({
        tipo: 'invalido',
        texto:
          tipo === 'DNI'
            ? 'El DNI debe tener exactamente 8 dígitos.'
            : `El RUC debe tener 11 dígitos y empezar con ${tipo === 'RUC 10' ? '10' : '20'}.`
      });
      return;
    }

    setConsulta({ tipo: 'cargando', texto: tipo === 'DNI' ? 'Consultando DNI…' : 'Consultando RUC…' });
    setDatos(null);
    CAMPOS_CONSULTA.forEach((k) => setValue(k, ''));

    try {
      const r = await clientesApi.consultar(tipo, documento);

      const sv = (k: keyof ClienteForm, v: string | null) =>
        setValue(k, v ?? '', { shouldValidate: k === 'nombre', shouldDirty: true });
      sv('nombre', r.nombre);
      sv('dniTitular', r.dniTitular);
      sv('domicilio', r.domicilio);
      sv('repNombre', r.representanteNombre);
      sv('repDni', r.representanteDni);
      sv('estadoSunat', r.estadoSunat);
      sv('condicionSunat', r.condicionSunat);
      setDatos(r);

      setConsulta(
        r.habilitado
          ? { tipo: 'ok', texto: MENSAJE_OK[tipo] }
          : { tipo: 'sin-datos', texto: r.motivo ?? 'Este cliente no se puede registrar.' }
      );
    } catch (error) {
      setConsulta({
        tipo: 'sin-datos',
        texto: error instanceof Error
          ? error.message
          : 'No se pudo consultar el documento. Inténtalo nuevamente.'
      });
    }
  };

  /** Solo se pasa a la confirmación con una consulta vigente, del mismo documento y que permita el registro. */
  const revisar = (v: ClienteForm) => {
    if (!datos || datos.tipoDocumento !== v.tipo || datos.numeroDocumento !== v.doc) {
      setConsulta({ tipo: 'invalido', texto: 'Consulta el documento antes de registrar al cliente.' });
      return;
    }
    if (!datos.habilitado) {
      setConsulta({ tipo: 'sin-datos', texto: datos.motivo ?? 'Este cliente no se puede registrar.' });
      return;
    }
    setConfirmar(v);
  };

  const guardar = async (v: ClienteForm) => {
    setGuardando(true);
    let creado: ClienteRegistrado;
    try {
      creado = await clientesApi.registrar(v.tipo, v.doc, v.telefono, v.correo);
    } catch (error) {
      setGuardando(false);
      setConfirmar(null);
      const mensaje = error instanceof Error ? error.message : 'No se pudo registrar al cliente. Inténtalo nuevamente.';
      toast.error(mensaje);
      if (error instanceof ClientesApiError && (error.codigo === 'DOCUMENTO_REGISTRADO' || error.codigo === 'CLIENTE_NO_HABILITADO')) {
        setConsulta({ tipo: 'sin-datos', texto: mensaje });
      }
      return;
    }
    setGuardando(false);
    toast.success(`Cliente registrado: ${creado.nombre}`);
    setConfirmar(null);
    cerrar(false);

    navigate(`/clientes/${creado.id}`);
  };

  const dniLen = tipo === 'DNI' ? 8 : 11;
  const nombreLabel = tipo === 'RUC 20' ? 'Razón social' : tipo === 'RUC 10' ? 'Nombre del titular' : 'Nombres y apellidos';


  return (
    <>
      <Sheet
        open={open}
        onOpenChange={cerrar}
        title="Registrar cliente"
        description="Persona natural, persona con negocio o persona jurídica."
        footer={
          <>
            <Button variant="secondary" onClick={() => cerrar(false)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              type="submit"
              form="form-cliente"
            >
              Revisar y registrar
            </Button>
          </>
        }
      >
        <form
          id="form-cliente"
          noValidate
          onSubmit={handleSubmit(revisar)}
        >
          <Seccion titulo="Tipo de cliente">
            <Segmented
              aria-label="Tipo de cliente"
              value={tipo}
              onValueChange={cambiarTipo}
              options={TIPOS_CLIENTE}
              fill
            />
          </Seccion>

          <Seccion titulo="Identificación">
            <div className="flex items-start gap-3 rounded-control bg-info-soft p-3 text-[0.8125rem] text-info-ink">
              <ShieldAlert
                className="mt-0.5 size-4 shrink-0"
                aria-hidden
              />
              <p>
                {tipo === 'DNI'
                  ? 'Los nombres y apellidos se obtienen de RENIEC al consultar el DNI.'
                  : tipo === 'RUC 10'
                    ? 'El titular, su DNI, el estado y la condición se obtienen de SUNAT.'
                    : 'La razón social, el domicilio fiscal, el estado, la condición y el representante legal se obtienen de SUNAT.'}
                {tipo !== 'DNI' && ' Solo se registran contribuyentes con estado ACTIVO y condición HABIDO.'}
              </p>
            </div>

            <Field
              label={
                tipo === 'DNI'
                  ? 'DNI'
                  : `RUC (inicia con ${tipo === 'RUC 10' ? '10' : '20'})`
              }
              error={errors.doc?.message}
              hint={
                <span className="num">
                  {doc.length}/{dniLen} dígitos
                </span>
              }
            >
              <Input
                inputMode="numeric"
                maxLength={dniLen}
                placeholder={`${dniLen} dígitos`}
                autoComplete="off"
                {...register('doc', {
                  onChange: limpiarConsulta
                })}
              />
            </Field>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                size="sm"
                onClick={consultar}
                loading={consulta.tipo === 'cargando'}
                disabled={consulta.tipo === 'cargando'}
              >
                <Search className="size-4" />
                {tipo === 'DNI' ? 'Consultar DNI' : 'Consultar RUC'}
              </Button>

              <p
                role="status"
                className="text-[0.8125rem] text-ink-muted"
              >
                {consulta.tipo === 'idle' && (
                  <>
                    {tipo === 'DNI'
                      ? 'Ingresa el DNI de 8 dígitos para consultar.'
                      : 'Ingresa el RUC de 11 dígitos para consultar.'}
                  </>
                )}

                {consulta.tipo === 'cargando' && consulta.texto}

                {consulta.tipo === 'invalido' && (
                  <span className="font-medium text-danger-ink">
                    {consulta.texto}
                  </span>
                )}

                {consulta.tipo === 'sin-datos' && (
                  <span className="font-medium text-danger-ink">
                    {consulta.texto ??
                      'No se encontraron datos. Puedes completar los campos manualmente.'}
                  </span>
                )}

                {consulta.tipo === 'ok' && (
                  <span className="inline-flex items-center gap-1 font-medium text-success-ink">
                    <Check className="size-3.5" aria-hidden />
                    {consulta.texto ?? 'Datos consultados correctamente.'}
                  </span>
                )}
              </p>
            </div>
          </Seccion>

          <Seccion
            titulo={
              tipo === 'RUC 20' ? 'Empresa' : 'Datos del cliente'
            }
          >
            <Field
              label={nombreLabel}
              error={errors.nombre?.message}
            >
              <Input
                autoComplete="off"
                readOnly
                placeholder="Se completa al consultar"
                {...register('nombre')}
              />
            </Field>

            {tipo === 'RUC 10' && (
              <>
                <Field
                  label="DNI del titular"
                  error={errors.dniTitular?.message}
                >
                  <Input
                    inputMode="numeric"
                    readOnly
                    placeholder="Obtenido de SUNAT"
                    {...register('dniTitular')}
                  />
                </Field>
              </>
            )}

            {tipo === 'RUC 20' && (
              <Field
                label="Domicilio fiscal"
                error={errors.domicilio?.message}
              >
                <Input readOnly placeholder="Se completa al consultar" {...register('domicilio')} />
              </Field>
            )}

            {tipo !== 'DNI' && (
              <div className="grid grid-cols-2 gap-4">
                <Field label="Estado SUNAT">
                  <Input readOnly placeholder="—" {...register('estadoSunat')} />
                </Field>
                <Field label="Condición SUNAT">
                  <Input readOnly placeholder="—" {...register('condicionSunat')} />
                </Field>
              </div>
            )}
          </Seccion>

          {tipo === 'RUC 20' && (
            <Seccion titulo="Representante legal">
              <Field
                label="Nombre del representante"
                error={errors.repNombre?.message}
              >
                <Input
                  autoComplete="off"
                  readOnly
                  placeholder="Se completa al consultar"
                  {...register('repNombre')}
                />
              </Field>

              <Field
                label="DNI del representante"
                error={errors.repDni?.message}
              >
                <Input
                  inputMode="numeric"
                  readOnly
                  placeholder="Se completa al consultar"
                  {...register('repDni')}
                />
              </Field>
            </Seccion>
          )}

          <Seccion titulo="Contacto">
            <Field
              label="Celular"
              error={errors.telefono?.message}
            >
              <Input
                inputMode="numeric"
                maxLength={9}
                placeholder="9XXXXXXXX"
                autoComplete="off"
                {...register('telefono')}
              />
            </Field>

            <Field
              label="Correo electrónico"
              error={errors.correo?.message}
            >
              <Input
                type="email"
                inputMode="email"
                maxLength={120}
                placeholder="nombre@dominio.com"
                autoComplete="off"
                {...register('correo')}
              />
            </Field>
          </Seccion>
        </form>
      </Sheet>

      <Modal
        open={!!confirmar}
        onOpenChange={(o) => {
          if (!o && !guardando) setConfirmar(null);
        }}
        title="Confirmar registro"
        description="Se creará un expediente con un identificador único."
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setConfirmar(null)}
              disabled={guardando}
            >
              Volver
            </Button>
            <Button
              variant="primary"
              loading={guardando}
              onClick={() => confirmar && guardar(confirmar)}
            >
              Confirmar registro
            </Button>
          </>
        }
      >
        {confirmar && (
          <DefinitionList
            items={[
              {
                label: 'Tipo',
                value: <Badge tone="teal">{confirmar.tipo}</Badge>
              },
              {
                label: 'Documento',
                value: confirmar.doc
              },
              {
                label:
                  confirmar.tipo === 'RUC 20'
                    ? 'Razón social'
                    : 'Nombre',
                value: confirmar.nombre
              },
              ...(confirmar.tipo === 'RUC 10'
                ? [
                  {
                    label: 'DNI del titular',
                    value: confirmar.dniTitular
                  }
                ]
                : []),
              ...(confirmar.tipo === 'RUC 20'
                ? [
                  {
                    label: 'Domicilio fiscal',
                    value: confirmar.domicilio
                  },
                  {
                    label: 'Representante',
                    value: `${confirmar.repNombre} · DNI ${confirmar.repDni}`
                  }
                ]
                : []),
              ...(confirmar.tipo !== 'DNI'
                ? [
                  {
                    label: 'SUNAT',
                    value: `${confirmar.estadoSunat} · ${confirmar.condicionSunat}`
                  }
                ]
                : []),
              {
                label: 'Celular',
                value: confirmar.telefono
              },
              {
                label: 'Correo',
                value: confirmar.correo
              },
              {
                label: 'Agencia',
                value: yo.agencia
              }
            ]}
          />
        )}
      </Modal>
    </>
  );
}
