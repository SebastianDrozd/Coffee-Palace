import styles from "./Toggle.module.css";

export default function Toggle({ checked, onChange, label, disabled, hideLabel = false }) {
  return (
    <label className={`${styles.toggle} ${disabled ? styles.disabled : ""}`}>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className={styles.input}
      />
      <span className={styles.track} aria-hidden="true">
        <span className={styles.thumb} />
      </span>
      <span className={hideLabel ? "visually-hidden" : styles.label}>{label}</span>
    </label>
  );
}
