"use client";

import { useEffect, useRef } from "react";
import styles from "./Modal.module.css";

/**
 * Accessible modal built on <dialog>.
 * variant: "kiosk" (big, round, touch-first) or "dashboard" (compact)
 */
export default function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  variant = "dashboard",
  size = "md",
  dismissible = true,
}) {
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`${styles.dialog} ${styles[variant]} ${styles[size]}`}
      aria-labelledby="modal-title"
      onCancel={(e) => {
        e.preventDefault();
        if (dismissible) onClose?.();
      }}
      onClick={(e) => {
        if (dismissible && e.target === e.currentTarget) onClose?.();
      }}
    >
      {open && (
        <div className={styles.inner}>
          <h2 id="modal-title" className={styles.title}>
            {title}
          </h2>
          <div className={styles.body}>{children}</div>
          {footer && <div className={styles.footer}>{footer}</div>}
        </div>
      )}
    </dialog>
  );
}
