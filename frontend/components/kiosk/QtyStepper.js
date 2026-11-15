import { MinusIcon, PlusIcon } from "@/components/ui/Icons";
import styles from "./QtyStepper.module.css";

export default function QtyStepper({ name, quantity, max = 20, onChange, size = "md" }) {
  return (
    <div className={`${styles.stepper} ${styles[size]}`}>
      <button
        type="button"
        className={styles.btn}
        onClick={() => onChange(quantity - 1)}
        aria-label={quantity === 1 ? `Quitar ${name}` : `Uno menos: ${name}`}
      >
        <MinusIcon strokeWidth={3} />
      </button>
      <span className={styles.qty} aria-live="polite">
        {quantity}
      </span>
      <button
        type="button"
        className={styles.btn}
        onClick={() => onChange(quantity + 1)}
        disabled={quantity >= max}
        aria-label={`Uno más: ${name}`}
      >
        <PlusIcon strokeWidth={3} />
      </button>
    </div>
  );
}
