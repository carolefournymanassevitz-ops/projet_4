import { Button } from './Button';
import type { FileHistoryItem } from '../services/files.service';
import { formatBytes, formatDate } from '../utils/format';
import styles from './FileRow.module.css';

type FileRowProps = {
  file: FileHistoryItem;
  onDelete: (id: string) => void;
  onCopyLink: (id: string) => void;
};

/** Composant purement présentationnel : il ne sait ni supprimer, ni appeler l'API.
 *  Il remonte l'intention (onDelete / onCopyLink) à la page qui l'utilise. */
export function FileRow({ file, onDelete, onCopyLink }: FileRowProps) {
  return (
    <li className={styles.row}>
      <span className={styles.icon} aria-hidden="true">
        📄
      </span>

      <span className={styles.details}>
        <span className={styles.name}>{file.originalFilename}</span>
        <span className={styles.meta}>
          {formatBytes(file.sizeBytes)} · envoyé le {formatDate(file.createdAt)} ·{' '}
          {file.expired ? 'expiré' : `expire le ${formatDate(file.expiresAt)}`}
          {file.passwordProtected && ' · 🔒 protégé'}
        </span>
      </span>

      <span className={styles.actions}>
        <span className={`${styles.badge} ${file.expired ? styles.badgeExpired : styles.badgeActive}`}>
          {file.expired ? 'Expiré' : 'Actif'}
        </span>
        {!file.expired && (
          <Button variant="ghost" onClick={() => onCopyLink(file.id)}>
            Copier le lien
          </Button>
        )}
        <Button
          variant="ghost"
          onClick={() => onDelete(file.id)}
          aria-label={`Supprimer ${file.originalFilename}`}
        >
          Supprimer
        </Button>
      </span>
    </li>
  );
}
