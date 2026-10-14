import { MotionConfig } from 'motion/react';
import { lazy } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { Toaster } from '@/components/ui/toast';
import { TooltipProvider } from '@/components/ui/tooltip';
import LoginPage from '@/features/auth/login-page';
import NotFoundPage from '@/features/not-found';
import { AuthProvider, useAuth } from '@/hooks/use-auth';
import { ThemeProvider } from '@/hooks/use-theme';

/* Carga diferida por pantalla: el dashboard (gráficos) no pesa en el resto de rutas. */
const DashboardPage = lazy(() => import('@/features/dashboard/dashboard-page'));
const ClientsPage = lazy(() => import('@/features/clients/clients-page'));
const ClientDetailPage = lazy(() => import('@/features/clients/client-detail-page'));
const RequestPage = lazy(() => import('@/features/loans/request-page'));
const LoansPage = lazy(() => import('@/features/loans/loans-page'));
const LoanDetailPage = lazy(() => import('@/features/loans/loan-detail-page'));
const PaymentsPage = lazy(() => import('@/features/payments/payments-page'));

function Rutas() {
  const { autenticado } = useAuth();
  if (!autenticado) return <LoginPage />;
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="clientes" element={<ClientsPage />} />
        <Route path="clientes/:id" element={<ClientDetailPage />} />
        <Route path="solicitud" element={<RequestPage />} />
        <Route path="solicitud/:clienteId" element={<RequestPage />} />
        <Route path="prestamos" element={<LoansPage />} />
        <Route path="prestamos/:id" element={<LoanDetailPage />} />
        <Route path="pagos" element={<PaymentsPage />} />
        <Route path="pagos/:id" element={<PaymentsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        {/* reducedMotion="user": respeta prefers-reduced-motion en todas las animaciones de Motion */}
        <MotionConfig reducedMotion="user">
          <TooltipProvider>
            <HashRouter><Rutas /></HashRouter>
            <Toaster />
          </TooltipProvider>
        </MotionConfig>
      </AuthProvider>
    </ThemeProvider>
  );
}
