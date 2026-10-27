import { MotionConfig } from 'motion/react';
import { lazy, useEffect } from 'react';
import { HashRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { Toaster, toast } from '@/components/ui/toast';
import { TooltipProvider } from '@/components/ui/tooltip';
import LoginPage from '@/features/auth/login-page';
import { PantallaCarga, PantallaErrorSesion, PantallaRolNoReconocido } from '@/features/auth/session-screens';
import NotFoundPage from '@/features/not-found';
import { AuthProvider, useAuth } from '@/hooks/use-auth';
import { rutaInicio, type Modulo } from '@/lib/permissions';
import { ThemeProvider } from '@/hooks/use-theme';

/* Carga diferida por pantalla: el dashboard (gráficos) no pesa en el resto de rutas.
   Con la protección por rol, el código de un módulo prohibido ni siquiera se descarga. */
const DashboardPage = lazy(() => import('@/features/dashboard/dashboard-page'));
const ClientsPage = lazy(() => import('@/features/clients/clients-page'));
const ClientDetailPage = lazy(() => import('@/features/clients/client-detail-page'));
const RequestPage = lazy(() => import('@/features/loans/request-page'));
const LoansPage = lazy(() => import('@/features/loans/loans-page'));
const LoanDetailPage = lazy(() => import('@/features/loans/loan-detail-page'));
const CajaPage = lazy(() => import('@/features/caja/caja-page'));
const GestionPage = lazy(() => import('@/features/caja/gestion-page'));
const SupervisionPage = lazy(() => import('@/features/caja/supervision-page'));
const ReposicionDetallePage = lazy(() => import('@/features/caja/reposicion-detalle-page'));

/** Guard de ruta: decide por URL (no por el menú). Sin permiso redirige a la pantalla de inicio del rol. */
function Protegida({ modulo }: { modulo: Modulo }) {
  const { puede, usuario } = useAuth();
  const permitido = puede(modulo);
  useEffect(() => { if (!permitido) toast.info('Tu rol no tiene acceso a ese módulo.'); }, [permitido]);
  return permitido ? <Outlet /> : <Navigate to={rutaInicio(usuario?.rol)} replace />;
}

/** «/» es el dashboard de la gerencia; el asesor no tiene dashboard y entra directo a Préstamos. */
function Inicio() {
  const { puede, usuario } = useAuth();
  return puede('dashboard') ? <DashboardPage /> : <Navigate to={rutaInicio(usuario?.rol)} replace />;
}

function Rutas() {
  const { fase, usuario } = useAuth();

  if (fase === 'cargando') return <PantallaCarga />;
  if (fase === 'error') return <PantallaErrorSesion />;
  if (fase === 'anonimo' || !usuario) return <LoginPage />;
  if (!usuario.rol) return <PantallaRolNoReconocido />;

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Inicio />} />
        <Route element={<Protegida modulo="clientes" />}>
          <Route path="clientes" element={<ClientsPage />} />
          <Route path="clientes/:id" element={<ClientDetailPage />} />
        </Route>
        <Route element={<Protegida modulo="solicitud" />}>
          <Route path="solicitud" element={<RequestPage />} />
          <Route path="solicitud/:clienteId" element={<RequestPage />} />
        </Route>
        <Route element={<Protegida modulo="prestamos" />}>
          <Route path="prestamos" element={<LoansPage />} />
          <Route path="prestamos/:id" element={<LoanDetailPage />} />
          {/* Enlace antiguo (favoritos) del módulo eliminado: el cronograma vive en el detalle de cada préstamo. */}
          <Route path="cuotas" element={<Navigate to="/prestamos" replace />} />
        </Route>
        <Route element={<Protegida modulo="caja" />}>
          <Route path="caja" element={<CajaPage />} />
          <Route path="caja/:id" element={<ReposicionDetallePage />} />
        </Route>
        <Route element={<Protegida modulo="reposiciones" />}>
          <Route path="reposiciones" element={<GestionPage />} />
          <Route path="reposiciones/:id" element={<ReposicionDetallePage />} />
        </Route>
        <Route element={<Protegida modulo="supervision" />}>
          <Route path="supervision" element={<SupervisionPage />} />
        </Route>
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
