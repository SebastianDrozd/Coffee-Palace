"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getActiveOrders, getOrderHistory, orderKeys, updateOrderStatus } from "@/lib/api/orders";
import ConfirmDialog from "@/components/dashboard/ConfirmDialog";
import OrderCard from "@/components/dashboard/OrderCard";
import { BellIcon, BellOffIcon } from "@/components/ui/Icons";
import { useChime } from "@/hooks/useChime";
import { useNow } from "@/hooks/useNow";
import { config } from "@/lib/config";
import { clockTime, formatBs, formatUsd, localDateKey, plural } from "@/lib/format";
import ui from "@/components/dashboard/dash.module.css";
import styles from "./orders.module.css";

const COLUMNS = [
  { status: "new", title: "Nuevos", empty: "Aquí llegan los pedidos nuevos de la tablet." },
  { status: "preparing", title: "Preparando", empty: "Nada en preparación." },
  { status: "ready", title: "Listos para entregar", empty: "Nada esperando por entregar." },
];

export default function OrdersPage() {
  const [view, setView] = useState("board");
  const chime = useChime();

  const active = useQuery({
    queryKey: orderKeys.active,
    queryFn: getActiveOrders,
    refetchInterval: config.ordersRefreshMs,
    refetchIntervalInBackground: true,
  });

  // Chime when an order with a higher id than we've seen shows up
  const latestId = active.data?.reduce((max, o) => Math.max(max, o.id), 0) ?? null;
  const seenId = useRef(null);
  const { play } = chime;
  useEffect(() => {
    if (latestId === null) return;
    if (seenId.current !== null && latestId > seenId.current) play();
    seenId.current = Math.max(seenId.current ?? 0, latestId);
  }, [latestId, play]);

  const activeCount = active.data?.length ?? 0;

  return (
    <>
      <div className={ui.pageHead}>
        <div>
          <h1 className={ui.pageTitle}>Pedidos</h1>
          <p className={ui.pageSub}>
            {active.isSuccess
              ? activeCount === 0
                ? "No hay pedidos abiertos en este momento."
                : plural(activeCount, "pedido abierto", "pedidos abiertos")
              : "Cargando pedidos…"}
          </p>
        </div>

        <div className={ui.headActions}>
          <div className={styles.tabs} role="tablist" aria-label="Vista de pedidos">
            <button
              role="tab"
              aria-selected={view === "board"}
              className={view === "board" ? styles.tabOn : styles.tab}
              onClick={() => setView("board")}
            >
              Pedidos abiertos
            </button>
            <button
              role="tab"
              aria-selected={view === "history"}
              className={view === "history" ? styles.tabOn : styles.tab}
              onClick={() => setView("history")}
            >
              Terminados hoy
            </button>
          </div>
          <button
            type="button"
            className={`${ui.btn} ${chime.enabled ? ui.pink : ui.secondary}`}
            onClick={chime.toggle}
            aria-pressed={chime.enabled}
          >
            {chime.enabled ? <BellIcon /> : <BellOffIcon />}
            {chime.enabled ? "Sonido activado" : "Sonido desactivado"}
          </button>
        </div>
      </div>

      {view === "board" ? <Board query={active} /> : <History />}
    </>
  );
}

function Board({ query }) {
  const queryClient = useQueryClient();
  const now = useNow();
  const [cancelling, setCancelling] = useState(null);

  const status = useMutation({
    mutationFn: ({ order, status }) => updateOrderStatus(order.id, status),
    onMutate: async ({ order, status }) => {
      await queryClient.cancelQueries({ queryKey: orderKeys.active });
      const previous = queryClient.getQueryData(orderKeys.active);
      queryClient.setQueryData(orderKeys.active, (list = []) =>
        ["completed", "cancelled"].includes(status)
          ? list.filter((o) => o.id !== order.id)
          : list.map((o) => (o.id === order.id ? { ...o, status } : o))
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(orderKeys.active, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["orders"] }),
  });

  const confirmCancel = () => {
    status.mutate(
      { order: cancelling, status: "cancelled" },
      { onSuccess: () => setCancelling(null) }
    );
  };

  if (query.isLoading) {
    return <div className={styles.board}>{COLUMNS.map((c) => <div key={c.status} className={styles.skeleton} />)}</div>;
  }

  if (query.isError) {
    return (
      <div className={`${ui.card} ${ui.empty}`}>
        <strong>No se pudieron cargar los pedidos</strong>
        {query.error.message}
        <div style={{ marginTop: 16 }}>
          <button className={`${ui.btn} ${ui.primary}`} onClick={() => query.refetch()}>
            Intentar de nuevo
          </button>
        </div>
      </div>
    );
  }

  const orders = query.data ?? [];

  return (
    <>
      {status.isError && (
        <p className={ui.alert} role="alert" style={{ marginBottom: 16 }}>
          No se pudo actualizar el pedido. {status.error.message}
        </p>
      )}
      {query.isRefetchError && (
        <p className={ui.alert} role="alert" style={{ marginBottom: 16 }}>
          Se perdió la conexión con el servidor. Mostrando los últimos pedidos recibidos.
        </p>
      )}

      <div className={styles.board}>
        {COLUMNS.map((col) => {
          const list = orders.filter((o) => o.status === col.status);
          return (
            <section key={col.status} className={`${styles.column} ${styles[col.status]}`} aria-labelledby={`col-${col.status}`}>
              <h2 id={`col-${col.status}`} className={styles.colHead}>
                <span className={styles.dot} />
                {col.title}
                <span className={styles.count}>{list.length}</span>
              </h2>
              <div className={styles.stack}>
                {list.length === 0 ? (
                  <p className={styles.colEmpty}>{col.empty}</p>
                ) : (
                  list.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      now={now}
                      busy={status.isPending && status.variables?.order.id === order.id}
                      onStatus={(o, s) => status.mutate({ order: o, status: s })}
                      onCancel={setCancelling}
                    />
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>

      <ConfirmDialog
        open={!!cancelling}
        title={cancelling ? `¿Cancelar el pedido #${cancelling.orderNumber}?` : ""}
        confirmLabel="Cancelar pedido"
        cancelLabel="Mantener pedido"
        onConfirm={confirmCancel}
        onCancel={() => setCancelling(null)}
        busy={status.isPending}
      >
        {cancelling && (
          <p style={{ margin: 0 }}>
            El pedido de {cancelling.customerName} pasará a Terminados hoy como cancelado.
          </p>
        )}
      </ConfirmDialog>
    </>
  );
}

function History() {
  const queryClient = useQueryClient();
  const now = useNow();
  const date = now !== null ? localDateKey(new Date(now)) : null;

  const history = useQuery({
    queryKey: orderKeys.history(date),
    queryFn: () => getOrderHistory(date),
    enabled: date !== null,
    refetchInterval: 30_000,
  });

  const reopen = useMutation({
    mutationFn: (order) => updateOrderStatus(order.id, "ready"),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["orders"] }),
  });

  if (history.isLoading || date === null) return <div className={styles.skeletonWide} />;
  if (history.isError) {
    return (
      <div className={`${ui.card} ${ui.empty}`}>
        <strong>No se pudo cargar el historial</strong>
        {history.error.message}
      </div>
    );
  }

  const orders = [...(history.data ?? [])].reverse();
  if (orders.length === 0) {
    return (
      <div className={`${ui.card} ${ui.empty}`}>
        <strong>Todavía no hay pedidos terminados hoy</strong>
        Los pedidos aparecen aquí cuando se entregan o se cancelan.
      </div>
    );
  }

  const completed = orders.filter((o) => o.status === "completed");
  const drinks = completed.reduce((n, o) => n + o.items.reduce((s, i) => s + i.quantity, 0), 0);
  const salesUsd = completed.reduce((n, o) => n + (o.totalUsd || 0), 0);
  const salesBs = completed.reduce((n, o) => n + (o.totalBs || 0), 0);

  return (
    <>
      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statValue}>{completed.length}</span>
          <span className={styles.statLabel}>{completed.length === 1 ? "pedido entregado" : "pedidos entregados"}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{drinks}</span>
          <span className={styles.statLabel}>{drinks === 1 ? "producto preparado" : "productos preparados"}</span>
        </div>
        {config.showPrices && salesUsd > 0 && (
          <div className={styles.stat}>
            <span className={styles.statValue}>{formatUsd(salesUsd)}</span>
            <span className={styles.statLabel}>en pedidos entregados</span>
          </div>
        )}
        {config.showPrices && salesBs > 0 && (
          <div className={styles.stat}>
            <span className={styles.statValue}>{formatBs(salesBs)}</span>
            <span className={styles.statLabel}>en bolívares, a la tasa de cada pedido</span>
          </div>
        )}
      </div>

      <div className={`${ui.card} ${styles.tableWrap}`}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Pedido</th>
              <th scope="col">Nombre</th>
              <th scope="col">Productos</th>
              {config.showPrices && <th scope="col" className={styles.num}>Total</th>}
              <th scope="col">Hora</th>
              <th scope="col">Estado</th>
              <th scope="col"><span className="visually-hidden">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td className={styles.orderNo}>#{o.orderNumber}</td>
                <td>{o.customerName}</td>
                <td className={styles.itemsCell}>
                  {o.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}
                  {o.note && <span className={styles.histNote}>Nota: {o.note}</span>}
                </td>
                {config.showPrices && (
                  <td className={styles.num}>
                    {o.totalUsd > 0 ? (
                      <>
                        {formatUsd(o.totalUsd)}
                        {o.totalBs != null && <span className={styles.subAmount}>{formatBs(o.totalBs)}</span>}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                )}
                <td className={styles.time}>{clockTime(o.createdAt)}</td>
                <td>
                  <span className={o.status === "completed" ? styles.pillDone : styles.pillCancelled}>
                    {o.status === "completed" ? "Entregado" : "Cancelado"}
                  </span>
                </td>
                <td className={styles.num}>
                  <button
                    type="button"
                    className={`${ui.btn} ${ui.ghost} ${ui.sm}`}
                    onClick={() => reopen.mutate(o)}
                    disabled={reopen.isPending}
                    title="Devolver este pedido al tablero como listo"
                  >
                    Reabrir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
