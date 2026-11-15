/* eslint-disable @next/next/no-img-element */
import { imageSrc } from "@/lib/api/client";
import DualPrice, { dualPriceText } from "@/components/ui/DualPrice";
import { PlusIcon } from "@/components/ui/Icons";
import { hasPrice } from "@/lib/format";
import styles from "./ProductTile.module.css";

export default function ProductTile({ product, quantity, rate, onAdd }) {
  const src = imageSrc(product.imageUrl);
  const priced = hasPrice(product.priceUsd);
  const label = `Agregar ${product.name}${priced ? `, ${dualPriceText(product.priceUsd, rate)}` : ""}${
    quantity ? `. ${quantity} en tu pedido` : ""
  }`;

  return (
    <button
      type="button"
      className={`${styles.tile} ${quantity ? styles.inCart : ""}`}
      onClick={() => onAdd(product)}
      aria-label={label}
    >
      {src ? (
        <span className={styles.photo}>
          <img src={src} alt="" loading="lazy" />
        </span>
      ) : (
        <span className={styles.nameOnly}>
          <span className={styles.bigName}>{product.name}</span>
        </span>
      )}

      <span className={styles.body}>
        {src && <span className={styles.name}>{product.name}</span>}
        {product.description && <span className={styles.desc}>{product.description}</span>}
        <span className={styles.footer}>
          {priced ? (
            <DualPrice
              usd={product.priceUsd}
              rate={rate}
              className={styles.price}
              mainClassName={styles.priceMain}
              subClassName={styles.priceSub}
            />
          ) : (
            <span />
          )}
          {quantity ? (
            <span key={quantity} className={`${styles.badge} ${styles.count}`}>
              {quantity}
            </span>
          ) : (
            <span className={styles.badge}>
              <PlusIcon strokeWidth={3} />
            </span>
          )}
        </span>
      </span>
    </button>
  );
}
