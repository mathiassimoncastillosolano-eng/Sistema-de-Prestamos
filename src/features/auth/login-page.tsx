import { zodResolver } from '@hookform/resolvers/zod';
import { CircleAlert, Eye, EyeOff, FileText, Info, Landmark, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { BrandMark, BrandName } from '@/components/layout/brand-mark';
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

  const enviar = async (v: Valores) => {
    setFallo(null);
    try {
      await entrar(v.correo, v.clave);
    } catch (e) {
      setFallo(e instanceof ApiError ? e.message : mensajeDe('DESCONOCIDO'));
      resetField('clave'); // la contraseña no se conserva tras un intento fallido
      setFocus('clave');
    }
  };

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <section className="pattern-steps relative flex flex-col justify-between gap-10 bg-side p-6 text-side-ink sm:p-10 lg:p-14">
        <div className="flex items-center gap-3 text-white"><BrandMark tile="light" /><BrandName /></div>
        <div className="max-w-lg">
          <h1 className="text-3xl font-semibold leading-tight text-white sm:text-4xl">{BRAND.lema}.</h1>
          <p className="mt-4 text-[0.9375rem] leading-relaxed text-side-ink/80">Registra préstamos, valida el endeudamiento y consulta cronogramas con reglas de negocio claras y trazables.</p>
          <ul className="mt-8 hidden space-y-3.5 sm:block">
            {puntos.map((p) => (
              <li key={p.texto} className="flex items-center gap-3 text-sm">
                <span className="grid size-8 place-items-center rounded-full bg-side-active text-copper"><p.icon className="size-4" aria-hidden /></span>{p.texto}
              </li>
            ))}
          </ul>
        </div>
        <p className="hidden text-xs text-side-muted sm:block">Los datos de clientes y préstamos son ficticios (demostración)</p>
      </section>

      <section className="relative flex items-center justify-center bg-canvas p-6 sm:p-10">
        <ThemeToggle className="absolute right-4 top-4" />
        <motion.form onSubmit={handleSubmit(enviar)} noValidate className="w-full max-w-sm" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: DUR.slow, ease: EASE }}>
          <h2 className="text-2xl font-semibold text-ink">Iniciar sesión</h2>
          <p className="mt-1 text-sm text-ink-muted">Ingresa con tu correo electrónico y tu contraseña.</p>

          <div className="mt-7 space-y-4">
            <Field label="Correo electrónico" error={errors.correo?.message}><Input type="email" inputMode="email" autoComplete="username" autoCapitalize="none" spellCheck={false} autoFocus {...register('correo')} /></Field>
            <Field label="Contraseña" error={errors.clave?.message}>
              <Input type={ver ? 'text' : 'password'} autoComplete="current-password" {...register('clave')}
                suffix={<button type="button" onClick={() => setVer((v) => !v)} aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'} className="-mr-1 rounded p-1 text-ink-muted hover:text-ink">{ver ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>} />
            </Field>
          </div>

          {aviso && !fallo && <p role="status" className="mt-4 flex items-start gap-2 rounded-control border border-line bg-sand px-3 py-2.5 text-sm text-sand-ink"><Info className="mt-0.5 size-4 shrink-0" aria-hidden />{aviso}</p>}
          {fallo && <p role="alert" className="mt-4 flex items-start gap-2 rounded-control border border-danger/30 bg-danger-soft px-3 py-2.5 text-sm text-danger-ink"><CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />{fallo}</p>}

          <Button type="submit" variant="primary" size="lg" className="mt-6 w-full" loading={isSubmitting}>{isSubmitting ? 'Verificando…' : 'Ingresar'}</Button>
        </motion.form>
      </section>
    </div>
  );
}
