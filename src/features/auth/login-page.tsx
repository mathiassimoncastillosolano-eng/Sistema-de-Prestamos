import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Info, Landmark, ShieldCheck, TrendingUp } from 'lucide-react';
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
import { BRAND, USUARIO_DEMO } from '@/lib/config';
import { DUR, EASE } from '@/lib/motion';

const schema = z.object({
  usuario: z.string().trim().min(1, 'Ingresa tu usuario.'),
  clave: z.string().min(1, 'Ingresa tu contraseña.')
});
type Valores = z.infer<typeof schema>;

const puntos = [
  { icon: ShieldCheck, texto: 'Límite de endeudamiento aplicado en toda la empresa' },
  { icon: Landmark, texto: 'Cronogramas con TEA y cuotas iguales' },
  { icon: TrendingUp, texto: 'Cancelación anticipada sobre el total pactado' }
];

export default function LoginPage() {
  const { entrar } = useAuth();
  const [ver, setVer] = useState(false);
  const [fallo, setFallo] = useState(false);
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<Valores>({ resolver: zodResolver(schema), defaultValues: { usuario: '', clave: '' } });

  const enviar = async (v: Valores) => {
    await new Promise((r) => setTimeout(r, 450)); // simula la latencia de un servicio
    setFallo(!entrar(v.usuario, v.clave));
  };

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <section className="pattern-steps relative flex flex-col justify-between gap-10 bg-side p-6 text-side-ink sm:p-10 lg:p-14">
        <div className="flex items-center gap-3 text-white"><BrandMark tile="light" /><BrandName /></div>
        <div className="max-w-lg">
          <h1 className="text-3xl font-semibold leading-tight text-white sm:text-4xl">{BRAND.lema}.</h1>
          <p className="mt-4 text-[0.9375rem] leading-relaxed text-side-ink/80">Valida el endeudamiento, genera cronogramas y registra pagos con reglas de negocio claras y trazables.</p>
          <ul className="mt-8 hidden space-y-3.5 sm:block">
            {puntos.map((p) => (
              <li key={p.texto} className="flex items-center gap-3 text-sm">
                <span className="grid size-8 place-items-center rounded-full bg-side-active text-copper"><p.icon className="size-4" aria-hidden /></span>{p.texto}
              </li>
            ))}
          </ul>
        </div>
        <p className="hidden text-xs text-side-muted sm:block">Prototipo con datos ficticios · Sin backend</p>
      </section>

      <section className="relative flex items-center justify-center bg-canvas p-6 sm:p-10">
        <ThemeToggle className="absolute right-4 top-4" />
        <motion.form onSubmit={handleSubmit(enviar)} noValidate className="w-full max-w-sm" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: DUR.slow, ease: EASE }}>
          <h2 className="text-2xl font-semibold text-ink">Iniciar sesión</h2>
          <p className="mt-1 text-sm text-ink-muted">Acceso de demostración para asesores de préstamos.</p>

          <div className="mt-7 space-y-4">
            <Field label="Usuario" error={errors.usuario?.message}><Input autoComplete="username" autoFocus {...register('usuario')} /></Field>
            <Field label="Contraseña" error={errors.clave?.message}>
              <Input type={ver ? 'text' : 'password'} autoComplete="current-password" {...register('clave')}
                suffix={<button type="button" onClick={() => setVer((v) => !v)} aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'} className="-mr-1 rounded p-1 text-ink-muted hover:text-ink">{ver ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>} />
            </Field>
          </div>

          {fallo && <p role="alert" className="mt-4 rounded-control border border-danger/30 bg-danger-soft px-3 py-2.5 text-sm text-danger-ink">Usuario o contraseña incorrectos. Usa las credenciales de demostración indicadas abajo.</p>}

          <Button type="submit" variant="primary" size="lg" className="mt-6 w-full" loading={isSubmitting}>Ingresar</Button>

          <div className="mt-6 rounded-card border border-line bg-sand p-4 text-sm text-sand-ink">
            <p className="flex items-start gap-2"><Info className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>Credenciales de demostración: <b className="font-semibold">{USUARIO_DEMO.usuario}</b> / <b className="font-semibold">{USUARIO_DEMO.clave}</b>. La autenticación es simulada y no ofrece seguridad real.</span></p>
            <button type="button" onClick={() => { setValue('usuario', USUARIO_DEMO.usuario, { shouldValidate: true }); setValue('clave', USUARIO_DEMO.clave, { shouldValidate: true }); }} className="mt-2 text-sm font-medium underline underline-offset-4 hover:no-underline">Completar con las credenciales de demostración</button>
          </div>
        </motion.form>
      </section>
    </div>
  );
}
