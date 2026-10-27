import { Badge } from '@/components/ui/badge';
import type { EstadoReposicionApi } from '@/services/caja-api';
import { ETIQUETA_ESTADO, TONO_ESTADO } from './caja-utils';

/** Estado de una reposición. El color acompaña al texto: nunca es lo único que lo distingue. */
export function EstadoReposicionBadge({ estado }: { estado: EstadoReposicionApi }) {
  return <Badge tone={TONO_ESTADO[estado]} dot>{ETIQUETA_ESTADO[estado]}</Badge>;
}
