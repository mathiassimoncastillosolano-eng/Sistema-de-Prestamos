import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Textarea } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { NumericInput } from '@/components/ui/numeric-input';
import { Select } from '@/components/ui/select';
import { toast } from '@/components/ui/toast';
import { money } from '@/lib/format';
import { LIMITES_TEXTO, MOTIVOS, cajaApi, mensajeError, nuevaClaveIdempotencia, type CajaResumenApi, type MotivoReposicionApi } from '@/services/caja-api';
import { codigoRep } from './caja-utils';

interface Props {
  open: boolean;
  onOpenChange: (abierto: boolean) => void;
  caja: CajaResumenApi;
  onCreada: () => void;
}

/** Solicitud en dos pasos: llenar y revisar. La clave de idempotencia nace al abrir: un doble clic o un reintento no duplica. */
export function DialogoSolicitar({ open, onOpenChange, caja, onCreada }: Props) {
  const navigate = useNavigate();
  const maximo = caja.capacidadLibre;
  const [monto, setMonto] = useState<number>(NaN);
  const [motivo, setMotivo] = useState<MotivoReposicionApi>('DESEMBOLSOS_PROGRAMADOS');
  const [comentarios, setComentarios] = useState('');
  const [revisando, setRevisando] = useState(false);
  const [tocado, setTocado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clave = useRef(nuevaClaveIdempotencia());
  const bloqueo = useRef(false);

  useEffect(() => {
    if (open) {
      setMonto(NaN); setMotivo('DESEMBOLSOS_PROGRAMADOS'); setComentarios(''); setRevisando(false); setTocado(false); setError(null);
      clave.current = nuevaClaveIdempotencia();
    }
  }, [open]);

  const errMonto = !Number.isFinite(monto) || monto <= 0 ? 'Indica cuánto necesitas.'
    : monto > maximo ? `Puedes solicitar como máximo ${money(maximo)} (límite ${money(caja.limite)} − efectivo ${money(caja.saldo)}${caja.autorizadoPendienteRecepcion > 0 ? ` − ya autorizado sin recibir ${money(caja.autorizadoPendienteRecepcion)}` : ''}).` : undefined;
  const largo = comentarios.trim().length;
  const errComentarios = largo < LIMITES_TEXTO.comentarioMin ? `Explica para qué necesitas el dinero (mínimo ${LIMITES_TEXTO.comentarioMin} caracteres; llevas ${largo}).` : undefined;

  const revisar = () => { setTocado(true); if (!errMonto && !errComentarios) setRevisando(true); };

  const enviar = async () => {
    if (bloqueo.current) return;
    bloqueo.current = true;
    setEnviando(true);
    setError(null);
    try {
      const d = await cajaApi.solicitar({ monto, motivo, comentarios: comentarios.trim(), claveIdempotencia: clave.current });
      toast.success(`Solicitud ${codigoRep(d.fila.numero)} enviada a gerencia`);
      onCreada();
      onOpenChange(false);
      navigate(`/caja/${d.fila.id}`);
    } catch (e) {
      setError(mensajeError(e));
      setRevisando(false); // vuelve al formulario para corregir
    } finally {
      bloqueo.current = false;
      setEnviando(false);
    }
  };

  const etiquetaMotivo = MOTIVOS.find((m) => m.valor === motivo)?.etiqueta ?? motivo;
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={revisando ? 'Revisa tu solicitud' : 'Solicitar reposición de caja'} size="lg"
      description={revisando ? 'Si todo está bien, envíala a gerencia. No se mueve efectivo hasta que la apruebe, te llegue el dinero y registres la recepción.' : `Tu caja admite hasta ${money(maximo)} más.`}
      footer={revisando
        ? <><Button onClick={() => setRevisando(false)} disabled={enviando}>Editar</Button><Button variant="primary" loading={enviando} onClick={() => void enviar()}>Enviar solicitud</Button></>
        : <><Button onClick={() => onOpenChange(false)}>Cancelar</Button><Button variant="primary" onClick={revisar}>Revisar</Button></>}>
      {revisando ? (
        <dl className="num divide-y divide-line text-sm">
          <div className="flex justify-between gap-4 py-2.5"><dt className="text-ink-muted">Monto solicitado</dt><dd className="font-semibold">{money(monto)}</dd></div>
          <div className="flex justify-between gap-4 py-2.5"><dt className="text-ink-muted">Motivo</dt><dd className="text-right font-semibold">{etiquetaMotivo}</dd></div>
          <div className="flex justify-between gap-4 py-2.5"><dt className="text-ink-muted">Efectivo actual</dt><dd className="font-semibold">{money(caja.saldo)}</dd></div>
          <div className="py-2.5"><dt className="text-ink-muted">Comentarios</dt><dd className="mt-1 whitespace-pre-wrap font-normal">{comentarios.trim()}</dd></div>
        </dl>
      ) : (
        <div className="grid gap-4">
          <Field label="Monto a solicitar" error={tocado ? errMonto : undefined} hint={`Máximo ${money(maximo)}.`}>
            <NumericInput value={monto} onValueChange={setMonto} decimals={2} prefix="S/" maxIntegerDigits={9} inputMode="decimal" />
          </Field>
          <Field label="Motivo">
            <Select value={motivo} onChange={(e) => setMotivo(e.target.value as MotivoReposicionApi)}>
              {MOTIVOS.map((m) => <option key={m.valor} value={m.valor}>{m.etiqueta}</option>)}
            </Select>
          </Field>
          <Field label="Comentarios" error={tocado ? errComentarios : undefined} hint="Gerencia los lee para decidir.">
            <Textarea value={comentarios} onChange={(e) => setComentarios(e.target.value)} rows={4} maxLength={LIMITES_TEXTO.max} />
          </Field>
        </div>
      )}
      {error && <p role="alert" className="mt-3 rounded-control bg-danger-soft p-3 text-sm font-medium text-danger-ink">{error}</p>}
    </Modal>
  );
}
