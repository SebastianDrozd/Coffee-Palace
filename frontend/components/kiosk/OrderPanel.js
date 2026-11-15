"use client";

import Link from "next/link";
import { useCart } from "@/components/kiosk/CartProvider";
import QtyStepper from "@/components/kiosk/QtyStepper";
import RateNote from "@/components/kiosk/RateNote";
import DualPrice from "@/components/ui/DualPrice";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { config } from "@/lib/config";
import { formatBs, formatUsd, hasPrice, itemCount, lineTotal, lineTotalBs, plural, toBs } from "@/lib/format";
import ui from "./kioskUi.module.css";
import styles from "./OrderPanel.module.css";

// Side panel on landscape tablets
export function OrderPanel() {
  const { items, setQuantity, maxQty } = useCart();
  const { rate, info } = useExchangeRate();
  const empty = items.length === 0;
  const total = lineTotal(items);
  const totalBs = lineTotalBs(items, rate);

  return (
    <aside className={styles.panel} aria-label="Tu pedido">
      <h2 className={styles.title}>Tu pedido</h2>

      {empty ? (
        <div className={styles.empty}>
          <span className={styles.emptyBean} aria-hidden="true" />
          <p>Toca algo rico para agregarlo aquí.</p>
        </div>
      ) : (
        <ul className={styles.lines}>
          {items.map((item) => (
            <li key={item.productId} className={styles.line}>
              <div className={styles.lineText}>
                <span className={styles.lineName}>{item.name}</span>
                {hasPrice(item.priceUsd) && (
                  <span className={styles.linePrice}>
                    {formatUsd(item.priceUsd * item.quantity)}
                    {rate && (
                      <span className={styles.lineBs}>{formatBs(toBs(item.priceUsd, rate) * item.quantity)}</span>
                    )}
                  </span>
                )}
              </div>
              <QtyStepper
                name={item.name}
                quantity={item.quantity}
                max={maxQty}
                onChange={(q) => setQuantity(item.productId, q)}
              />
            </li>
          ))}
        </ul>
      )}

      <div className={styles.footer}>
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
        <Link
          href="/order/review"
          className={`${ui.btn} ${ui.primary} ${ui.block}`}
          aria-disabled={empty}
          tabIndex={empty ? -1 : undefined}
          data-disabled={empty || undefined}
        >
          Revisar pedido
        </Link>
        {config.showPrices && <RateNote info={info} className={styles.rate} />}
      </div>
    </aside>
  );
}

// Bottom bar on portrait tablets and phones
export function OrderBar() {
  const { items } = useCart();
  const { rate } = useExchangeRate();
  if (items.length === 0) return null;
  const total = lineTotal(items);
  const totalBs = lineTotalBs(items, rate);

  return (
    <div className={styles.bar}>
      <span className={styles.barSummary}>
        <span>{plural(itemCount(items), "producto", "productos")}</span>
        {config.showPrices && total > 0 && (
          <DualPrice
            usd={total}
            bs={totalBs}
            className={styles.barAmounts}
            mainClassName={styles.barMain}
            subClassName={styles.barSub}
          />
        )}
      </span>
      <Link href="/order/review" className={`${ui.btn} ${ui.primary}`}>
        Revisar pedido
      </Link>
    </div>
  );
}
