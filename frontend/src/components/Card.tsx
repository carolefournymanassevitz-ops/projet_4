import type { ReactNode } from 'react';
import styles from './Card.module.css';

type CardProps = {
  title?: string;
  wide?: boolean;
  children: ReactNode;
};

export function Card({ title, wide = false, children }: CardProps) {
  return (
    <section className={`${styles.card} ${wide ? styles.wide : ''}`}>
      {title && <h1 className={styles.title}>{title}</h1>}
      {children}
    </section>
  );
}
