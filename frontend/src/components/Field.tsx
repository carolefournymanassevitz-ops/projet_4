import { useId } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';
import styles from './Field.module.css';

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  optional?: boolean;
  hint?: string;
  /** Permet d'injecter un <select> ou tout autre contrôle à la place de l'input. */
  control?: ReactNode;
};

export function Field({ label, optional = false, hint, control, ...inputProps }: FieldProps) {
  // useId garantit un identifiant unique : indispensable pour lier <label> et champ
  // (accessibilité — un lecteur d'écran annonce alors le bon libellé).
  const generatedId = useId();
  const id = inputProps.id ?? generatedId;
  const hintId = hint ? `${id}-hint` : undefined;

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label} {optional && <span className={styles.optional}>(optionnel)</span>}
      </label>
      {control ?? <input id={id} className={styles.input} aria-describedby={hintId} {...inputProps} />}
      {hint && (
        <span id={hintId} className={styles.hint}>
          {hint}
        </span>
      )}
    </div>
  );
}
