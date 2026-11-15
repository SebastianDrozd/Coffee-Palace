"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createOrder } from "@/lib/api/orders";
import { productKeys } from "@/lib/api/products";
import { useCart } from "@/components/kiosk/CartProvider";
import KioskHeader from "@/components/kiosk/KioskHeader";
import QtyStepper from "@/components/kiosk/QtyStepper";
import RateNote from "@/components/kiosk/RateNote";
import DualPrice from "@/components/ui/DualPrice";
import { ChevronLeftIcon, CloseIcon } from "@/components/ui/Icons";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { useMenu } from "@/hooks/useMenu";
import { config } from "@/lib/config";
import { formatBs, formatUsd, hasPrice, itemCount, lineTotal, lineTotalBs, plural, toBs } from "@/lib/format";
import ui from "@/components/kiosk/kioskUi.module.css";
import styles from "./review.module.css";

export default function ReviewPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { items, details, setDetails, setQuantity, remove, clear, setLastOrder, maxQty } = useCart();
  const { availableIds, isLoaded } = useMenu();
  const { rate, info: rateInfo } = useExchangeRate();
  const [showNameError, setShowNameError] = useState(false);

  const unavailable = isLoaded ? items.filter((i) => !availableIds.has(i.productId)) : [];
  const total = lineTotal(items);
  const totalBs = lineTotalBs(items, rate);
  const nameMissing = !details.customerName.trim();

  const placeOrder = useMutation({
    mutationFn: () =>
      createOrder({
        customerName: details.customerName.trim(),
        note: details.note.trim(),
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      }),
    onSuccess: (order) => {
      setLastOrder(order);
      clear();
      router.replace("/order/done");
    },
    onError: (err) => {
      if (err.status === 409) queryClient.invalidateQueries({ queryKey: productKeys.all });
    },
  });

  const submit = (e) => {
    e.preventDefault();
    if (nameMissing) {
      setShowNameError(true);
      return;
    }
    if (unavailable.length || items.length === 0) return;
    placeOrder.mutate();
  };

  const backButton = (
    <Link href="/order" className={`${ui.btn} ${ui.soft} ${ui.small}`}>
      <ChevronLeftIcon strokeWidth={3} width={22} height={22} />
      Agregar más
    </Link>
  );

  // Order placed: the cart is now empty while we move to the thank-you screen.
  if (placeOrder.isSuccess) return null;

  if (items.length === 0) {
    return (
      <div className={styles.page}>
        <KioskHeader left={backButton} />
        <div className={styles.emptyState}>
          <span className={styles.emptyBean} aria-hidden="true" />
          <h1>Tu pedido está vacío</h1>
          <p>Elige algo rico para empezar.</p>
          <Link href="/order" className={`${ui.btn} ${ui.primary} ${ui.large}`}>
            Ver el menú
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <KioskHeader left={backButton} />

      <form className={styles.main} onSubmit={submit} noValidate>
        <section className={styles.items} aria-labelledby="review-title">
          <h1 id="review-title" className={styles.title}>
            Revisa tu pedido
          </h1>
          <p className={styles.subtitle}>
            {plural(itemCount(items), "producto", "productos")}
          </p>

          <ul className={styles.lines}>
            {items.map((item) => {
              const gone = unavailable.some((u) => u.productId === item.productId);
              return (
                <li key={item.productId} className={`${styles.line} ${gone ? styles.gone : ""}`}>
                  <div className={styles.lineText}>
                    <span className={styles.lineName}>{item.name}</span>
                    {gone ? (
                      <span className={styles.goneNote}>Lo sentimos, se acaba de agotar</span>
                    ) : (
                      hasPrice(item.priceUsd) && (
                        <span className={styles.lineEach}>
                          {formatUsd(item.priceUsd)} c/u
                          {rate && <> ({formatBs(toBs(item.priceUsd, rate))})</>}
                        </span>
                      )
                    )}
                  </div>

                  {!gone && (
                    <QtyStepper
                      name={item.name}
                      quantity={item.quantity}
                      max={maxQty}
                      size="lg"
                      onChange={(q) => setQuantity(item.productId, q)}
                    />
                  )}

                  {hasPrice(item.priceUsd) && !gone && (
                    <DualPrice
                      usd={item.priceUsd * item.quantity}
                      bs={rate ? toBs(item.priceUsd, rate) * item.quantity : null}
                      className={styles.lineTotal}
                      mainClassName={styles.lineTotalMain}
                      subClassName={styles.lineTotalSub}
                    />
                  )}

                  <button
                    type="button"
                    className={styles.remove}
                    onClick={() => remove(item.productId)}
                    aria-label={`Quitar ${item.name}`}
                  >
                    <CloseIcon strokeWidth={3} />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section className={styles.checkout} aria-label="Termina tu pedido">
          <label className={styles.field}>
            <span className={styles.label}>Nombre para el pedido</span>
            <input
              className={`${styles.input} ${showNameError && nameMissing ? styles.invalid : ""}`}
              value={details.customerName}
              onChange={(e) => setDetails((d) => ({ ...d, customerName: e.target.value }))}
              maxLength={40}
              autoComplete="off"
              autoCapitalize="words"
              enterKeyHint="done"
              placeholder="Tu nombre"
              aria-invalid={showNameError && nameMissing}
              aria-describedby="name-help"
            />
            <span
              id="name-help"
              className={`${styles.help} ${showNameError && nameMissing ? styles.helpError : ""}`}
            >
              {showNameError && nameMissing
                ? "Escribe tu nombre para llamarte cuando esté listo."
                : "Diremos este nombre cuando tu pedido esté listo."}
            </span>
          </label>

          <label className={styles.field}>
            <span className={styles.label}>¿Alguna indicación?</span>
            <textarea
              className={`${styles.input} ${styles.textarea}`}
              value={details.note}
              onChange={(e) => setDetails((d) => ({ ...d, note: e.target.value }))}
              maxLength={200}
              rows={3}
              placeholder="Leche deslactosada, bien caliente, sin azúcar…"
            />
          </label>

          <div className={styles.spacer} />

          {config.showPrices && total > 0 && (
            <div className={styles.total}>
              <span>Total</span>
              <DualPrice
                usd={total}
                bs={totalBs}
                className={styles.totalAmounts}
                mainClassName={styles.totalMain}
                subClassName={styles.totalSub}
              />
            </div>
          )}
          {config.showPrices && <RateNote info={rateInfo} className={styles.rate} />}

          {unavailable.length > 0 && (
            <p className={styles.error} role="alert">
              {unavailable.length === 1
                ? "Quita el producto agotado para confirmar tu pedido."
                : "Quita los productos agotados para confirmar tu pedido."}
            </p>
          )}
          {placeOrder.isError && !unavailable.length && (
            <p className={styles.error} role="alert">
              {placeOrder.error.status === 409
                ? "Algo de tu pedido se acaba de agotar. Revisa tus productos."
                : `No pudimos enviar tu pedido. ${placeOrder.error.message}`}
            </p>
          )}

          <button
            type="submit"
            className={`${ui.btn} ${ui.primary} ${ui.large} ${ui.block}`}
            disabled={placeOrder.isPending || unavailable.length > 0}
          >
            {placeOrder.isPending ? "Enviando pedido…" : "Confirmar pedido"}
          </button>
        </section>
      </form>
    </div>
  );
}
