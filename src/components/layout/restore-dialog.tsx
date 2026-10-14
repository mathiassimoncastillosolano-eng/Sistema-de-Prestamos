import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { toast } from '@/components/ui/toast';
import { restaurarDb } from '@/services/store';

export function RestoreDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const navigate = useNavigate();
  const restaurar = () => {
    restaurarDb();
    onOpenChange(false);
    toast.success('Datos de demostración restaurados');
    navigate('/');
  };
  return (
    <Modal open={open} onOpenChange={onOpenChange} size="sm" title="Restaurar datos de demostración"
      description="Se descartarán los clientes y préstamos creados en este navegador y se volverá a los datos iniciales."
      footer={<><Button variant="secondary" onClick={() => onOpenChange(false)}>Cancelar</Button><Button variant="danger" onClick={restaurar}>Restaurar datos</Button></>} />
  );
}
