import '@tanstack/react-table';
import type { RowData } from '@tanstack/react-table';

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    /** Alinea la columna a la derecha (importes). */
    derecha?: boolean;
    /** Clases extra para cabecera y celdas (anchos, visibilidad responsive). */
    className?: string;
    /** Descripción de la columna (tooltip nativo de la cabecera) cuando el encabezado abreviado necesita aclaración. */
    descripcion?: string;
  }
}
