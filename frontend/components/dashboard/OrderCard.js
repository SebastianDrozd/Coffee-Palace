"use client";

import DualPrice from "@/components/ui/DualPrice";
import { ClockIcon, UndoIcon } from "@/components/ui/Icons";
import { config } from "@/lib/config";
import { clockTime, minutesSince, waitLabel } from "@/lib/format";
import ui from "./dash.module.css";
import styles from "./OrderCard.module.css";

export const NEXT_STEP = {
  new: { status: "preparing", label: "Preparar" },
  preparing: { status: "ready", label: "Marcar listo" },
  ready: { status: "completed", label: "Entregar" },
};

const PREVIOUS = { preparing: "new", ready: "preparing" };

export default function OrderCard({ order, now, onStatus, onCancel, busy }) {
  const next = NEXT_STEP[order.status];
  const back = PREVIOUS[order.status];
  const waited = now !== null ? minutesSince(order.createdAt, now) : 0;
  const slow = order.status !== "ready" && waited >= config.slowOrderMinutes;
  const justArrived = now !== null && now - new Date(order.createdAt).getTime() < 20_000;

  return (
    <article
      className={`${styles.card} ${styles[order.status]} ${justArrived ? styles.fresh : ""}`}
      aria-label={`Pedido ${order.orderNumber} de ${order.customerName}`}
    >
      <header className={styles.head}>
        <span className={styles.number}>#{order.orderNumber}</span>
        <span className={styles.who}>
          <span className={styles.name}>{order.customerName}</span>
          <span className={styles.placed}>Recibido {clockTime(order.createdAt)}</span>
        </span>
        {now !== null && (
          <span className={`${styles.wait} ${slow ? styles.slow : ""}`} title="Tiempo desde que se hizo el pedido">
            <ClockIcon />
            {waitLabel(order.createdAt, now)}
          </span>
        )}
      </header>

      <ul className={styles.items}>
        {order.items.map((item) => (
          <li key={item.id}>
            <span className={styles.qty}>{item.quantity}×</span>
            <span>{item.name}</span>
          </li>
        ))}
      </ul>

      {order.note && <p className={styles.note}>{order.note}</p>}

      <footer className={styles.foot}>
        {config.showPrices && order.totalUsd > 0 && (
          <DualPrice
            usd={order.totalUsd}
            bs={order.totalBs}
            className={styles.total}
            mainClassName={styles.totalMain}
            subClassName={styles.totalSub}
          />
        )}
        <span className={styles.actions}>
          {back && (
            <button
              type="button"
              className={`${ui.btn} ${ui.ghost} ${ui.sm} ${ui.iconOnly}`}
              onClick={() => onStatus(order, back)}
              disabled={busy}
              title="Regresar un paso"
              aria-label={`Regresar el pedido ${order.orderNumber} un paso`}
            >
              <UndoIcon />
            </button>
          )}
          <button
            type="button"
            className={`${ui.btn} ${ui.ghost} ${ui.sm}`}
            onClick={() => onCancel(order)}
            disabled={busy}
          >
            Cancelar
          </button>
          {next && (
            <button
              type="button"
              className={`${ui.btn} ${order.status === "ready" ? ui.pink : ui.primary} ${ui.sm}`}
              onClick={() => onStatus(order, next.status)}
              disabled={busy}
            >
              {next.label}
            </button>
          )}
        </span>
      </footer>
    </article>
  );
}
