import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface Props {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { to: string; label: string };
}

export function PageHeader({ title, description, actions, back }: Props) {
  return (
    <div className="mb-6">
      {back && (
        <Link to={back.to} className="no-print mb-3 inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-ink-muted transition-colors hover:text-ink">
          <ArrowLeft className="size-4" aria-hidden />{back.label}
        </Link>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-ink sm:text-[1.75rem] sm:leading-9">{title}</h1>
          {description && <p className="mt-1 max-w-2xl text-sm text-ink-muted">{description}</p>}
        </div>
        {actions && <div className="no-print flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
