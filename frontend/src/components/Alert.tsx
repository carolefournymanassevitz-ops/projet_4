import type { ReactNode } from 'react';
import styles from './Alert.module.css';

type AlertProps = {
  variant: 'error' | 'success' | 'info';
  children: ReactNode;
};

const ICONS: Record<AlertProps['variant'], string> = {
  error: '⚠',
  success: '✓',
  info: 'ⓘ',
};

export function Alert({ variant, children }: AlertProps) {
  return (
    // role="alert" : les lecteurs d'écran annoncent le message dès son apparition
    <p className={`${styles.alert} ${styles[variant]}`} role={variant === 'error' ? 'alert' : 'status'}>
      <span className={styles.icon} aria-hidden="true">
        {ICONS[variant]}
      </span>
      <span>{children}</span>
    </p>
  );
}
