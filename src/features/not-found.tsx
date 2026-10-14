import { SearchX } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

export default function NotFoundPage() {
  return <EmptyState icon={SearchX} title="Página no encontrada" description="La dirección no existe o fue movida. Vuelve al dashboard para continuar." action={<Button asChild variant="primary"><Link to="/">Ir al dashboard</Link></Button>} />;
}
