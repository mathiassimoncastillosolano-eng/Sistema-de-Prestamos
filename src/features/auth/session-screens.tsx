import { Loader2, ShieldAlert, WifiOff } from 'lucide-react';
import { useState } from 'react';
import { BrandMark, BrandName } from '@/components/layout/brand-mark';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { useAuth } from '@/hooks/use-auth';

function Marco({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-canvas p-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-5 text-center">
        <div className="flex items-center gap-3 text-ink"><BrandMark /><BrandName /></div>
        {children}
      </div>
    </main>
  );
}

/** Mientras no se sabe si hay sesión no se pinta nada protegido (ni siquiera el esqueleto de la aplicación). */
export function PantallaCarga() {
  return (
    <Marco>
      <p role="status" className="flex items-center gap-2 text-sm text-ink-muted"><Loader2 className="size-4 animate-spin" aria-hidden />Verificando tu sesión…</p>
    </Marco>
  );
}

export function PantallaErrorSesion() {
  const { mensajeError, reintentar } = useAuth();
  return (
    <Marco>
      <span aria-hidden className="grid size-12 place-items-center rounded-full bg-warning-soft text-warning-ink"><WifiOff className="size-6" /></span>
      <div role="alert">
        <h1 className="text-lg font-semibold text-ink">No se pudo verificar tu sesión</h1>
        <p className="mt-1 text-sm text-ink-muted">{mensajeError}</p>
      </div>
      <Button variant="primary" onClick={reintentar}>Reintentar</Button>
    </Marco>
  );
}

/** Perfil con rol no reconocido: no se concede ningún permiso ni se carga ningún módulo. */
export function PantallaRolNoReconocido() {
  const { salir } = useAuth();
  const [saliendo, setSaliendo] = useState(false);
  const cerrar = async () => {
    setSaliendo(true);
    try { await salir(); } catch { toast.error('No se pudo cerrar la sesión. Inténtalo nuevamente.'); setSaliendo(false); }
  };
  return (
    <Marco>
      <span aria-hidden className="grid size-12 place-items-center rounded-full bg-danger-soft text-danger-ink"><ShieldAlert className="size-6" /></span>
      <div role="alert">
        <h1 className="text-lg font-semibold text-ink">Tu cuenta no tiene acceso</h1>
        <p className="mt-1 text-sm text-ink-muted">Tu perfil tiene un rol no reconocido por la aplicación. Contacta con el administrador.</p>
      </div>
      <Button variant="primary" loading={saliendo} onClick={() => { void cerrar(); }}>Cerrar sesión</Button>
    </Marco>
  );
}
