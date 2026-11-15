"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useCart } from "@/components/kiosk/CartProvider";
import KioskHeader from "@/components/kiosk/KioskHeader";
import { OrderBar, OrderPanel } from "@/components/kiosk/OrderPanel";
import ProductTile from "@/components/kiosk/ProductTile";
import StartOverButton from "@/components/kiosk/StartOverButton";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { useMenu } from "@/hooks/useMenu";
import ui from "@/components/kiosk/kioskUi.module.css";
import styles from "./order.module.css";

export default function OrderPage() {
  const { menu, isLoading, error, refetch } = useMenu();
  const { items, add } = useCart();
  const { rate } = useExchangeRate();
  const scrollRef = useRef(null);
  const sectionRefs = useRef(new Map());
  const [activeId, setActiveId] = useState(null);

  const qtyFor = (productId) => items.find((i) => i.productId === productId)?.quantity ?? 0;

  // Highlight the category currently scrolled into view
  const syncActive = useCallback(() => {
    const scroller = scrollRef.current;
    if (!scroller || menu.length === 0) return;
    const top = scroller.getBoundingClientRect().top;
    let current = menu[0].id;
    for (const category of menu) {
      const el = sectionRefs.current.get(category.id);
      if (el && el.getBoundingClientRect().top - top <= 80) current = category.id;
    }
    const atBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 4;
    if (atBottom) current = menu[menu.length - 1].id;
    setActiveId(current);
  }, [menu]);

  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(syncActive);
    };
    frame = requestAnimationFrame(syncActive);
    scroller.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      scroller.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [syncActive]);

  const jumpTo = (id) => {
    const scroller = scrollRef.current;
    const el = sectionRefs.current.get(id);
    if (!scroller || !el) return;
    scroller.scrollTo({
      top: scroller.scrollTop + el.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 8,
      behavior: "smooth",
    });
    setActiveId(id);
  };

  const current = activeId ?? menu[0]?.id;

  return (
    <div className={styles.page}>
      <KioskHeader right={<StartOverButton />} />

      <div className={styles.main}>
        <nav className={styles.rail} aria-label="Categorías del menú">
          {menu.map((category) => (
            <button
              key={category.id}
              type="button"
              className={`${styles.railItem} ${current === category.id ? styles.railActive : ""}`}
              aria-current={current === category.id ? "true" : undefined}
              onClick={() => jumpTo(category.id)}
            >
              {category.name}
            </button>
          ))}
        </nav>

        <main ref={scrollRef} className={styles.menu}>
          {isLoading && <MenuSkeleton />}

          {error && !isLoading && (
            <div className={styles.message}>
              <h2>No se pudo cargar el menú</h2>
              <p>{error.message}</p>
              <button className={`${ui.btn} ${ui.primary}`} onClick={refetch}>
                Intentar de nuevo
              </button>
            </div>
          )}

          {!isLoading && !error && menu.length === 0 && (
            <div className={styles.message}>
              <h2>Todavía no hay nada en el menú</h2>
              <p>Pídele a un barista que tome tu pedido.</p>
            </div>
          )}

          {menu.map((category) => (
            <section
              key={category.id}
              ref={(el) => {
                if (el) sectionRefs.current.set(category.id, el);
                else sectionRefs.current.delete(category.id);
              }}
              className={styles.section}
              aria-labelledby={`cat-${category.id}`}
            >
              <h2 id={`cat-${category.id}`} className={styles.sectionTitle}>
                {category.name}
              </h2>
              <ul className={styles.grid}>
                {category.products.map((product) => (
                  <li key={product.id}>
                    <ProductTile product={product} quantity={qtyFor(product.id)} rate={rate} onAdd={add} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </main>

        <div className={styles.panel}>
          <OrderPanel />
        </div>
      </div>

      <div className={styles.bar}>
        <OrderBar />
      </div>
    </div>
  );
}

function MenuSkeleton() {
  return (
    <div className={styles.section} aria-hidden="true">
      <div className={`${styles.skel} ${styles.skelTitle}`} />
      <ul className={styles.grid}>
        {Array.from({ length: 6 }, (_, i) => (
          <li key={i} className={`${styles.skel} ${styles.skelTile}`} />
        ))}
      </ul>
    </div>
  );
}
