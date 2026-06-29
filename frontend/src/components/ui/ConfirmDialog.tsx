import { useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { Input } from "./Input";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (inputValue?: string) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  loading?: boolean;
  /** Si se provee, muestra un campo de texto y pasa su valor a onConfirm. */
  prompt?: { label: string; placeholder?: string; required?: boolean };
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirmar",
  loading = false,
  prompt,
}: ConfirmDialogProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleConfirm = () => {
    if (prompt?.required && !value.trim()) {
      inputRef.current?.focus();
      return;
    }
    onConfirm(prompt ? value.trim() : undefined);
    setValue("");
  };

  const handleClose = () => {
    setValue("");
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} className="max-w-sm">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-50">
          <AlertTriangle className="h-6 w-6 text-rose-500" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-slate-800">{title}</h3>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>

        {prompt && (
          <div className="w-full text-left">
            <Input
              ref={inputRef}
              id="confirm-input"
              label={prompt.label}
              placeholder={prompt.placeholder}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
              autoFocus
            />
          </div>
        )}

        <div className="flex w-full gap-3">
          <Button
            variant="outline"
            className="flex-1 justify-center"
            onClick={handleClose}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            variant="danger"
            className="flex-1 justify-center"
            onClick={handleConfirm}
            loading={loading}
            disabled={prompt?.required && !value.trim()}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
