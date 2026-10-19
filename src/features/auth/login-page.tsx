import { zodResolver } from '@hookform/resolvers/zod';
import { CircleAlert, Eye, EyeOff, Info } from 'lucide-react';
import { motion } from 'motion/react';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { BrandLockup } from '@/components/layout/brand-mark';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/use-auth';
import { DUR, EASE } from '@/lib/motion';
import { ApiError, mensajeDe } from '@/services/auth-api';

const schema = z.object({
  correo: z.string().trim().min(1, 'Ingresa tu correo electrónico.').email('Ingresa un correo electrónico válido.'),
  clave: z.string().min(1, 'Ingresa tu contraseña.')
});
type Valores = z.infer<typeof schema>;

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
    <main className="login-scope relative flex min-h-dvh flex-col items-center justify-center px-5 py-10 text-ink sm:px-6">
      <motion.div className="flex w-full max-w-[25rem] flex-col items-center" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: DUR.slow, ease: EASE }}>
        <BrandLockup size="lg" variant="transparent" principalClassName="text-navy-ink" />

        <form onSubmit={handleSubmit(enviar)} noValidate aria-busy={isSubmitting} className="mt-8 w-full rounded-panel border border-line bg-surface p-6 shadow-[0_1px_2px_rgb(11_24_48/0.05),0_16px_40px_-18px_rgb(11_24_48/0.22)] sm:p-8">
          <h1 className="text-xl font-semibold tracking-tight text-ink">Iniciar sesión</h1>
          <p className="mt-1 text-sm text-ink-muted">Ingresa con tu correo electrónico y tu contraseña.</p>

          <div className="mt-6 space-y-4">
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
        </form>
      </motion.div>
    </main>
  );
}
