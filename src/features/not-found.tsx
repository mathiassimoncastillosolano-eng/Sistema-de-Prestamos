import { SearchX } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { useAuth } from '@/hooks/use-auth';
import { rutaInicio } from '@/lib/permissions';

export default function NotFoundPage() {
  const { usuario } = useAuth();
  return <EmptyState icon={SearchX} title="Página no encontrada" description="La dirección no existe o fue movida. Vuelve al inicio para continuar." action={<Button asChild variant="primary"><Link to={rutaInicio(usuario?.rol)}>Ir al inicio</Link></Button>} />;
}
