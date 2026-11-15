"use client";

import Modal from "@/components/ui/Modal";
import ui from "./dash.module.css";

export default function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = "Mantener",
  onConfirm,
  onCancel,
  busy = false,
  error,
  tone = "danger",
  confirmDisabled = false,
}) {
  return (
    <Modal
      open={open}
      onClose={busy ? undefined : onCancel}
      title={title}
      size="sm"
      footer={
        <>
          <button type="button" className={`${ui.btn} ${ui.secondary}`} onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`${ui.btn} ${tone === "danger" ? ui.danger : ui.primary}`}
            onClick={onConfirm}
            disabled={busy || confirmDisabled}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <div style={{ display: "grid", gap: 12, lineHeight: 1.5 }}>
        {children}
        {error && <p className={ui.alert}>{error}</p>}
      </div>
    </Modal>
  );
}
