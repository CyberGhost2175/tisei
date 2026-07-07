"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { MSym } from "./symbols";

type ModalTone = "default" | "danger" | "success";

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  tone = "default",
  loading = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  tone?: ModalTone;
  loading?: boolean;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose, loading]);

  if (!open) return null;

  const icon =
    tone === "danger" ? "warning" : tone === "success" ? "check_circle" : "info";
  const iconBg =
    tone === "danger"
      ? "bg-error-container text-error"
      : tone === "success"
        ? "bg-primary-container/20 text-primary"
        : "bg-primary-container/15 text-primary";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div className="absolute inset-0 bg-inverse-surface/40 backdrop-blur-[2px]" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative w-full max-w-md bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="p-6">
          <div className="flex gap-4">
            <div
              className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${iconBg}`}
            >
              <MSym name={icon} className="text-[22px]" />
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <h2 id={titleId} className="font-headline-sm text-headline-sm text-on-surface pr-6">
                {title}
              </h2>
              {description && (
                <div className="text-body-sm text-on-surface-variant mt-1">{description}</div>
              )}
            </div>
            {!loading && (
              <button
                type="button"
                onClick={onClose}
                className="absolute top-4 right-4 w-8 h-8 rounded-full hover:bg-surface-container-high flex items-center justify-center text-on-surface-variant"
                aria-label="Закрыть"
              >
                <MSym name="close" className="text-[20px]" />
              </button>
            )}
          </div>
          {children && <div className="mt-5">{children}</div>}
        </div>
      </div>
    </div>
  );
}

export function ModalActions({
  onCancel,
  onConfirm,
  cancelLabel = "Отмена",
  confirmLabel = "Подтвердить",
  loading = false,
  destructive = false,
  confirmDisabled = false,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  cancelLabel?: string;
  confirmLabel?: string;
  loading?: boolean;
  destructive?: boolean;
  confirmDisabled?: boolean;
}) {
  return (
    <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-6 pt-4 border-t border-outline-variant">
      <button
        type="button"
        onClick={onCancel}
        disabled={loading}
        className="px-4 py-2.5 rounded-xl border border-outline-variant text-on-surface font-label-md hover:bg-surface-container-low disabled:opacity-50"
      >
        {cancelLabel}
      </button>
      <button
        type="button"
        onClick={onConfirm}
        disabled={loading || confirmDisabled}
        className={
          destructive
            ? "px-4 py-2.5 rounded-xl bg-error text-on-error font-label-md hover:opacity-90 disabled:opacity-50"
            : "px-4 py-2.5 rounded-xl bg-primary text-on-primary font-label-md hover:opacity-90 disabled:opacity-50"
        }
      >
        {loading ? "Подождите..." : confirmLabel}
      </button>
    </div>
  );
}

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Подтвердить",
  cancelLabel = "Отмена",
  loading = false,
  destructive = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  destructive?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      tone={destructive ? "danger" : "default"}
      loading={loading}
    >
      <ModalActions
        onCancel={onClose}
        onConfirm={onConfirm}
        cancelLabel={cancelLabel}
        confirmLabel={confirmLabel}
        loading={loading}
        destructive={destructive}
      />
    </Modal>
  );
}

export function PromptModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  value,
  onChange,
  placeholder,
  confirmLabel = "Сохранить",
  loading = false,
  required = true,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  confirmLabel?: string;
  loading?: boolean;
  required?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} description={description} loading={loading}>
      <input
        autoFocus
        className="w-full bg-surface-container-low border border-outline-variant rounded-xl px-4 py-3 text-body-md focus:ring-2 focus:ring-primary-container"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (!required || value.trim())) onConfirm();
        }}
      />
      <ModalActions
        onCancel={onClose}
        onConfirm={onConfirm}
        confirmLabel={confirmLabel}
        loading={loading}
        confirmDisabled={required && !value.trim()}
      />
    </Modal>
  );
}

export function AlertModal({
  open,
  onClose,
  title,
  description,
  tone = "default",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  tone?: ModalTone;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} description={description} tone={tone}>
      <div className="flex justify-end mt-2">
        <button
          type="button"
          onClick={onClose}
          className="px-5 py-2.5 rounded-xl bg-primary text-on-primary font-label-md"
        >
          Понятно
        </button>
      </div>
    </Modal>
  );
}
