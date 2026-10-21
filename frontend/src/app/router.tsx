import { createBrowserRouter, Navigate } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import { AdminLayout } from "@/components/AdminLayout";
import { RESIDENT_ROLES, UserRole } from "@/types/domain";
import { LoginPage } from "@/features/auth/pages/LoginPage";
import { OwnerDashboardPage } from "@/features/dashboard/pages/OwnerDashboardPage";
import { ChargesPage } from "@/features/dashboard/pages/ChargesPage";
import { PaymentsPage } from "@/features/dashboard/pages/PaymentsPage";
import { PaymentInfoPage } from "@/features/dashboard/pages/PaymentInfoPage";
import { ResidentLayout } from "@/features/dashboard/components/ResidentLayout";
import { AdminDashboardPage } from "@/features/admin-panel/pages/AdminDashboardPage";
import { ClientsPage } from "@/features/users/pages/ClientsPage";
import { TowersPage } from "@/features/towers/pages/TowersPage";
import { UnitsPage } from "@/features/units/pages/UnitsPage";
import { BillingPage } from "@/features/billing/pages/BillingPage";
import { AllPaymentsPage } from "@/features/payments/pages/AllPaymentsPage";
import { BankStatementPage } from "@/features/bank-statement/pages/BankStatementPage";
import { ExchangeRatePage } from "@/features/exchange-rate/pages/ExchangeRatePage";
import { SettingsPage } from "@/features/admin-panel/pages/SettingsPage";
import { ReportsPage } from "@/features/reports/pages/ReportsPage";
import { ReceiptsPage } from "@/features/receipts/pages/ReceiptsPage";

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/",
    element: (
      <ProtectedRoute requiredRole={[...RESIDENT_ROLES]}>
        <AppLayout>
          <ResidentLayout />
        </AppLayout>
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <OwnerDashboardPage /> },
      { path: "cuotas", element: <ChargesPage /> },
      { path: "pagos", element: <PaymentsPage /> },
      { path: "datos-de-pago", element: <PaymentInfoPage /> },
    ],
  },
  {
    path: "/admin",
    element: (
      <ProtectedRoute requiredRole={UserRole.ADMIN}>
        <AppLayout>
          <AdminLayout />
        </AppLayout>
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <AdminDashboardPage /> },
      { path: "clientes", element: <ClientsPage /> },
      // Ruta anterior: los enlaces guardados siguen funcionando.
      { path: "usuarios", element: <Navigate to="/admin/clientes" replace /> },
      { path: "torres", element: <TowersPage /> },
      { path: "departamentos", element: <UnitsPage /> },
      { path: "gasto-comun", element: <BillingPage /> },
      { path: "pagos", element: <AllPaymentsPage /> },
      { path: "recibos", element: <ReceiptsPage /> },
      { path: "extracto", element: <BankStatementPage /> },
      { path: "reportes", element: <ReportsPage /> },
      { path: "tasa", element: <ExchangeRatePage /> },
      { path: "ajustes", element: <SettingsPage /> },
    ],
  },
  {
    path: "*",
    element: <Navigate to="/" replace />,
  },
]);
