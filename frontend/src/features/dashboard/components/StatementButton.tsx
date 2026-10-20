import { Download } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useResident } from "../hooks/useResident";

/** Estado de cuenta en PDF, en el encabezado de Inicio y de Mis cuotas. */
export function StatementButton() {
  const { downloading, downloadStatement } = useResident();
  return (
    <Button size="sm" variant="outline" loading={downloading} onClick={downloadStatement}>
      {!downloading && <Download className="h-4 w-4" />}
      <span className="hidden sm:inline">Estado de cuenta</span>
      <span className="sm:hidden">PDF</span>
    </Button>
  );
}
