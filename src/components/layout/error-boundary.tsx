import { TriangleAlert } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

interface Props { children: ReactNode; resetKey?: string }
interface State { error: Error | null }

/** Error recuperable: la pantalla no queda en blanco y el usuario puede reintentar. */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };
  static getDerivedStateFromError(error: Error): State { return { error }; }
  override componentDidCatch(error: Error, info: ErrorInfo) { console.error('Error de interfaz:', error, info.componentStack); }
  override componentDidUpdate(prev: Props) { if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null }); }
  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <EmptyState icon={TriangleAlert} tone="danger" title="No se pudo mostrar esta pantalla"
        description="Ocurrió un error inesperado. Tus datos no se han modificado. Puedes reintentar o volver al inicio."
        action={<div className="flex gap-2"><Button variant="primary" onClick={() => this.setState({ error: null })}>Reintentar</Button><Button onClick={() => { window.location.hash = '#/'; this.setState({ error: null }); }}>Ir al inicio</Button></div>} />
    );
  }
}
