"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/kiosk/CartProvider";
import { CheckIcon } from "@/components/ui/Icons";
import { config } from "@/lib/config";
import ui from "@/components/kiosk/kioskUi.module.css";
import styles from "./done.module.css";

export default function DonePage() {
  const router = useRouter();
  const { lastOrder, setLastOrder } = useCart();
  const [secondsLeft, setSecondsLeft] = useState(config.doneScreenSeconds);

  // Nothing to show (e.g. the page was reloaded) — go back to the start.
  useEffect(() => {
    if (!lastOrder) router.replace("/");
  }, [lastOrder, router]);

  useEffect(() => {
    if (!lastOrder) return;
    const timer = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearInterval(timer);
  }, [lastOrder]);

  useEffect(() => {
    if (secondsLeft <= 0) {
      setLastOrder(null);
      router.replace("/");
    }
  }, [secondsLeft, router, setLastOrder]);

  const finish = () => {
    setLastOrder(null);
    router.replace("/");
  };

  if (!lastOrder) return null;

  const firstName = lastOrder.customerName.split(" ")[0];

  return (
    <main className={styles.screen}>
      <div className={styles.saucer}>
        <span className={styles.check} aria-hidden="true">
          <CheckIcon strokeWidth={3.5} />
        </span>
        <p className={styles.numberLabel}>Pedido</p>
        <p className={styles.number}>#{lastOrder.orderNumber}</p>
      </div>

      <div className={styles.copy}>
        <h1 className={styles.title}>¡Gracias, {firstName}!</h1>
        <p className={styles.sub}>Te llamaremos por tu nombre cuando tu pedido esté listo.</p>
      </div>

      <div className={styles.actions}>
        <button type="button" className={`${ui.btn} ${ui.primary} ${ui.large}`} onClick={finish}>
          Listo
        </button>
        <p className={styles.countdown}>
          Volviendo al inicio en {Math.max(0, secondsLeft)} s
        </p>
      </div>
    </main>
  );
}
