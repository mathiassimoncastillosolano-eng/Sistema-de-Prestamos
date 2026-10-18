-- Requisito del registro de clientes: correo opcional para datos anteriores.
-- Es seguro ejecutar este script más de una vez.
ALTER TABLE public.clientes
    ADD COLUMN IF NOT EXISTS correo text;

CREATE UNIQUE INDEX IF NOT EXISTS clientes_correo_uq
    ON public.clientes (correo);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'clientes_correo_formato_ck'
          AND conrelid = 'public.clientes'::regclass
    ) THEN
        ALTER TABLE public.clientes
            ADD CONSTRAINT clientes_correo_formato_ck CHECK (
                correo IS NULL OR (
                    correo = btrim(correo)
                    AND correo ~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
                )
            );
    END IF;
END;
$$;
