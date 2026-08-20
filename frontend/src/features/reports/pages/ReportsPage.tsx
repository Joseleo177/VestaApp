import { useState, useEffect } from "react";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { SearchSelect } from "@/components/ui/SearchSelect";
import { ReportService } from "@/services/report.service";
import { userService } from "@/features/users/services/user.service";
import { User } from "@/types/domain";
import { toast } from "sonner";

export function ReportsPage() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loadingCollected, setLoadingCollected] = useState(false);
  const [loadingDebt, setLoadingDebt] = useState(false);

  // Users for Account Statement
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingStatement, setLoadingStatement] = useState(false);

  useEffect(() => {
    async function loadUsers() {
      try {
        setLoadingUsers(true);
        const data = await userService.list();
        setUsers(data);
      } catch (err) {
        console.error(err);
        toast.error("Error al cargar la lista de usuarios");
      } finally {
        setLoadingUsers(false);
      }
    }
    loadUsers();
  }, []);

  const handleExportCollected = async () => {
    if (!startDate || !endDate) {
      toast.error("Debe seleccionar ambas fechas.");
      return;
    }
    if (startDate > endDate) {
      toast.error("La fecha de inicio no puede ser mayor que la de fin.");
      return;
    }

    try {
      setLoadingCollected(true);
      await ReportService.downloadCollectedPayments(startDate, endDate);
      toast.success("Reporte de cobros exportado");
    } catch (error) {
      console.error(error);
      toast.error("Error al exportar reporte de cobros");
    } finally {
      setLoadingCollected(false);
    }
  };

  const handleExportDebt = async () => {
    try {
      setLoadingDebt(true);
      await ReportService.downloadOwedCharges();
      toast.success("Reporte de deudas exportado");
    } catch (error) {
      console.error(error);
      toast.error("Error al exportar reporte de deudas");
    } finally {
      setLoadingDebt(false);
    }
  };

  const handleExportStatement = async () => {
    if (!selectedUserId) {
      toast.error("Selecciona un usuario primero");
      return;
    }
    try {
      setLoadingStatement(true);
      await ReportService.downloadAccountStatement(selectedUserId);
      toast.success("Estado de cuenta exportado");
    } catch (error) {
      console.error(error);
      toast.error("Error al exportar el estado de cuenta");
    } finally {
      setLoadingStatement(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[28px] font-bold leading-tight text-ios-label">Reportes</h1>
        <p className="text-sm text-ios-secondary">
          Exporta información financiera
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <h3 className="flex items-center gap-2 text-lg font-semibold">
              <FileSpreadsheet className="h-5 w-5 text-brand-500" />
              Reporte de Cobros
            </h3>
          </CardHeader>
          <CardBody className="space-y-4">
            <p className="text-sm text-ios-secondary">
              Exporta todos los pagos <strong>confirmados</strong> en un rango de fechas.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Fecha de inicio"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <Input
                label="Fecha de fin"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <Button
              className="w-full"
              onClick={handleExportCollected}
              disabled={loadingCollected}
            >
              <Download className="h-4 w-4" />
              {loadingCollected ? "Generando..." : "Exportar a Excel"}
            </Button>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="flex items-center gap-2 text-lg font-semibold">
              <FileSpreadsheet className="h-5 w-5 text-red-500" />
              Reporte de Deudas
            </h3>
          </CardHeader>
          <CardBody className="space-y-4">
            <p className="text-sm text-ios-secondary">
              Exporta todas las cuotas pendientes o pagadas parcialmente, mostrando lo que se adeuda a la fecha.
            </p>
            <div className="h-16" /> {/* Spacer to align with left card inputs */}
            <Button
              className="w-full"
              variant="outline"
              onClick={handleExportDebt}
              disabled={loadingDebt}
            >
              <Download className="h-4 w-4" />
              {loadingDebt ? "Generando..." : "Exportar a Excel"}
            </Button>
          </CardBody>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <h3 className="flex items-center gap-2 text-lg font-semibold">
              <FileText className="h-5 w-5 text-blue-500" />
              Estado de Cuenta (Por Cliente)
            </h3>
          </CardHeader>
          <CardBody className="space-y-4">
            <p className="text-sm text-ios-secondary">
              Genera un documento PDF formal con el resumen financiero, saldo a favor y detalle de cuotas de un propietario específico.
            </p>
            <div className="grid gap-4 sm:grid-cols-[1fr_auto] items-end">
              <SearchSelect
                label="Seleccionar propietario"
                value={selectedUserId}
                onChange={setSelectedUserId}
                options={users.map(u => ({ value: u.id, label: `${u.fullName} (V-${u.cedula})` }))}
                placeholder={loadingUsers ? "Cargando usuarios..." : "Buscar por nombre o cédula..."}
                disabled={loadingUsers}
              />
              <Button
                onClick={handleExportStatement}
                disabled={loadingStatement || !selectedUserId}
              >
                <Download className="h-4 w-4" />
                {loadingStatement ? "Generando..." : "Descargar PDF"}
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
