import { zodResolver } from '@hookform/resolvers/zod';
import { CircleAlert, Eye, EyeOff, FileText, Info, Landmark, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { BrandLogo } from '@/components/layout/brand-mark';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/use-auth';
import { BRAND } from '@/lib/config';
import { DUR, EASE } from '@/lib/motion';
import { ApiError, mensajeDe } from '@/services/auth-api';

const schema = z.object({
  correo: z.string().trim().min(1, 'Ingresa tu correo electrónico.').email('Ingresa un correo electrónico válido.'),
  clave: z.string().min(1, 'Ingresa tu contraseña.')
});
type Valores = z.infer<typeof schema>;

/** «Gestión de préstamos con » + «control total» (el énfasis turquesa se aplica solo a esa parte del lema). */
const [antes] = BRAND.lema.split('control total');

const puntos = [
  { icon: ShieldCheck, texto: 'Límite de endeudamiento aplicado en toda la empresa' },
  { icon: Landmark, texto: 'Cronogramas con TEA y cuotas iguales' },
  { icon: FileText, texto: 'Cronograma y ficha del préstamo en PDF' }
];

export default function LoginPage() {
  const { entrar, aviso } = useAuth();
  const [ver, setVer] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  const { register, handleSubmit, resetField, setFocus, formState: { errors, isSubmitting } } = useForm<Valores>({ resolver: zodResolver(schema), defaultValues: { correo: '', clave: '' } });

  /* Evita solicitudes duplicadas (doble clic o Enter repetido) mientras hay un envío en curso. */
  const enviando = useRef(false);
  const enviar = async (v: Valores) => {
    if (enviando.current) return;
    enviando.current = true;
    setFallo(null);
    try {
      await entrar(v.correo, v.clave);
    } catch (e) {
      setFallo(e instanceof ApiError ? e.message : mensajeDe('DESCONOCIDO'));
      resetField('clave'); // la contraseña no se conserva tras un intento fallido
      setFocus('clave');
    } finally {
      enviando.current = false;
    }
  };

  return (
    <div className="grid min-h-dvh grid-rows-[auto_1fr] lg:grid-cols-[1.05fr_1fr] lg:grid-rows-1">
      <section className="brand-panel flex flex-col gap-6 p-5 sm:p-10 lg:justify-between lg:gap-10 lg:p-14">
        <div className="bp-logo w-28 p-2.5 sm:w-36 lg:w-44 lg:p-3"><BrandLogo /></div>

        <div className="hidden w-full max-w-[34rem] sm:block">
          <h1 className="text-3xl font-semibold leading-[1.15] text-white lg:text-[2.5rem]">{antes}<span className="bp-title-accent">control total</span>.</h1>
          <p className="bp-muted mt-4 max-w-[30rem] text-[0.9375rem] leading-relaxed">Registra préstamos, valida el endeudamiento y consulta cronogramas con reglas de negocio claras y trazables.</p>
          <ul className="mt-8 hidden max-w-[30rem] space-y-2.5 lg:block">
            {puntos.map((p) => (
              <li key={p.texto} className="bp-item flex items-center gap-3 rounded-control px-3.5 py-3 text-sm text-white/90">
                <span className="bp-chip grid size-8 shrink-0 place-items-center rounded-lg"><p.icon className="size-4" aria-hidden /></span>{p.texto}
              </li>
            ))}
          </ul>
        </div>

        <p className="bp-muted hidden text-xs lg:block">{BRAND.nombre} · {BRAND.descriptor} · Los datos de clientes y préstamos son ficticios (demostración)</p>
      </section>

      <section className="relative flex items-center justify-center bg-canvas p-5 sm:p-10">
        <ThemeToggle className="absolute right-4 top-4" />
        <motion.form onSubmit={handleSubmit(enviar)} noValidate aria-busy={isSubmitting} className="w-full max-w-[26rem] sm:rounded-panel sm:border sm:border-line sm:bg-surface sm:p-8 sm:shadow-pop" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: DUR.slow, ease: EASE }}>
          <h2 className="text-2xl font-semibold text-ink">Iniciar sesión</h2>
          <p className="mt-1 text-sm text-ink-muted">Ingresa con tu correo electrónico y tu contraseña.</p>

          <div className="mt-7 space-y-4">
            <Field label="Correo electrónico" error={errors.correo?.message}><Input type="email" inputMode="email" autoComplete="username" autoCapitalize="none" spellCheck={false} autoFocus readOnly={isSubmitting} {...register('correo')} /></Field>
            <Field label="Contraseña" error={errors.clave?.message}>
              <Input type={ver ? 'text' : 'password'} autoComplete="current-password" readOnly={isSubmitting} {...register('clave')}
                suffix={<button type="button" onClick={() => setVer((v) => !v)} aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'} className="-mr-1 grid size-8 place-items-center rounded-md text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink">{ver ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>} />
            </Field>
          </div>

          <div aria-live="polite">
            {aviso && !fallo && <p role="status" className="mt-4 flex items-start gap-2 rounded-control border border-line bg-tint px-3 py-2.5 text-sm text-tint-ink"><Info className="mt-0.5 size-4 shrink-0" aria-hidden />{aviso}</p>}
            {fallo && <p role="alert" className="mt-4 flex items-start gap-2 rounded-control border border-danger/30 bg-danger-soft px-3 py-2.5 text-sm text-danger-ink"><CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />{fallo}</p>}
          </div>

          <Button type="submit" variant="primary" size="lg" className="mt-6 w-full" loading={isSubmitting}>{isSubmitting ? 'Verificando…' : 'Ingresar'}</Button>
        </motion.form>
      </section>
    </div>
  );
}
