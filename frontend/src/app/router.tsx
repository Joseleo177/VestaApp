import { createBrowserRouter, Navigate } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import { AdminLayout } from "@/components/AdminLayout";
import { UserRole } from "@/types/domain";
import { LoginPage } from "@/features/auth/pages/LoginPage";
import { OwnerDashboardPage } from "@/features/dashboard/pages/OwnerDashboardPage";
import { AdminDashboardPage } from "@/features/admin-panel/pages/AdminDashboardPage";
import { UsersPage } from "@/features/users/pages/UsersPage";
import { TowersPage } from "@/features/towers/pages/TowersPage";
import { UnitsPage } from "@/features/units/pages/UnitsPage";
import { BillingPage } from "@/features/billing/pages/BillingPage";
import { AllPaymentsPage } from "@/features/payments/pages/AllPaymentsPage";
import { BankStatementPage } from "@/features/bank-statement/pages/BankStatementPage";
import { ExchangeRatePage } from "@/features/exchange-rate/pages/ExchangeRatePage";
import { SettingsPage } from "@/features/admin-panel/pages/SettingsPage";

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/",
    element: (
      <ProtectedRoute requiredRole={UserRole.OWNER}>
        <AppLayout>
          <OwnerDashboardPage />
        </AppLayout>
      </ProtectedRoute>
    ),
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
      { path: "usuarios", element: <UsersPage /> },
      { path: "torres", element: <TowersPage /> },
      { path: "departamentos", element: <UnitsPage /> },
      { path: "gasto-comun", element: <BillingPage /> },
      { path: "pagos", element: <AllPaymentsPage /> },
      { path: "extracto", element: <BankStatementPage /> },
      { path: "tasa", element: <ExchangeRatePage /> },
      { path: "ajustes", element: <SettingsPage /> },
    ],
  },
  {
    path: "*",
    element: <Navigate to="/" replace />,
  },
]);
