import { ReactNode } from "react";
import { Inbox } from "lucide-react";

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({
  title = "No hay registros encontrados",
  description = "Cuando existan datos, aparecerán aquí.",
  icon,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-ios-fill text-ios-secondary">
        {icon ?? <Inbox className="h-7 w-7" />}
      </div>
      <h3 className="text-[15px] font-semibold text-ios-label">{title}</h3>
      <p className="mt-1 max-w-sm text-[13px] text-ios-secondary">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
