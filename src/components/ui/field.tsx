import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react';
import { CircleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FieldProps {
  label: ReactNode;
  /** Un único control (Input, Select, Textarea…). Recibe id, aria-invalid y aria-describedby. */
  children: ReactElement<Record<string, unknown>>;
  error?: string;
  hint?: ReactNode;
  optional?: boolean;
  className?: string;
}

/** Etiqueta + control + ayuda + error junto al campo, correctamente enlazados para lectores de pantalla. */
export function Field({ label, children, error, hint, optional, className }: FieldProps) {
  const uid = useId();
  const id = (children.props.id as string | undefined) ?? `f-${uid}`;
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const describedBy = [hintId, errId].filter(Boolean).join(' ') || undefined;
  const control = isValidElement(children) ? cloneElement(children, { id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy }) : children;

  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
        {optional && <span className="ml-1.5 font-normal text-ink-muted">(opcional)</span>}
      </label>
      {control}
      {hint && !error && <p id={hintId} className="text-[0.8125rem] text-ink-muted">{hint}</p>}
      {error && (
        <p id={errId} role="alert" className="flex items-start gap-1.5 text-[0.8125rem] font-medium text-danger-ink">
          <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      )}
    </div>
  );
}
