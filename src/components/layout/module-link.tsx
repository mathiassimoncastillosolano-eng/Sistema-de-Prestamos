import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import type { Modulo } from '@/lib/permissions';

interface Props {
  modulo: Modulo;
  to: string;
  className?: string;
  /** Clases del contenido cuando el rol no puede abrir el módulo (sin hover ni cursor de enlace). */
  planoClassName?: string;
  children: ReactNode;
}

/** Enlace que solo es navegable si el rol puede usar el módulo de destino; si no, muestra el contenido sin enlace. */
export function ModuleLink({ modulo, to, className, planoClassName, children }: Props) {
  const { puede } = useAuth();
  if (!puede(modulo)) return <div className={planoClassName}>{children}</div>;
  return <Link to={to} className={className}>{children}</Link>;
}
