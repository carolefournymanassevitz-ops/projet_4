import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { Alert } from '../components/Alert';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Field } from '../components/Field';
import { ApiError } from '../services/http';
import { filesService, type FileInfo } from '../services/files.service';
import { formatBytes } from '../utils/format';
import styles from './forms.module.css';

/** Déclenche le téléchargement d'un Blob dans le navigateur, sans navigation. */
function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function DownloadPage() {
  const { id = '' } = useParams<{ id: string }>();

  const [info, setInfo] = useState<FileInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    filesService
      .getInfo(id)
      .then(setInfo)
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : 'Lien invalide.'));
  }, [id]);

  async function handleDownload(event: FormEvent) {
    event.preventDefault();
    if (!info) return;

    setIsDownloading(true);
    setDownloadError(null);
    try {
      const blob = await filesService.download(id, password || undefined);
      saveBlob(blob, info.originalFilename);
    } catch (err) {
      setDownloadError(err instanceof ApiError ? err.message : 'Le téléchargement a échoué.');
    } finally {
      setIsDownloading(false);
    }
  }

  if (loadError) {
    return (
      <Card title="Télécharger un fichier">
        <Alert variant="error">{loadError}</Alert>
      </Card>
    );
  }

  if (!info) {
    return (
      <Card title="Télécharger un fichier">
        <p>Chargement…</p>
      </Card>
    );
  }

  return (
    <Card title="Télécharger un fichier">
      <div className={styles.fileSummary}>
        <span aria-hidden="true">📄</span>
        <span className={styles.fileSummaryDetails}>
          <span className={styles.fileName}>{info.originalFilename}</span>
          <span className={styles.fileSize}>{formatBytes(info.sizeBytes)}</span>
        </span>
      </div>

      {info.passwordProtected ? (
        <Alert variant="info">Ce fichier est protégé par mot de passe.</Alert>
      ) : (
        <Alert variant="info">Ce fichier n'est protégé par aucun mot de passe.</Alert>
      )}

      {downloadError && <Alert variant="error">{downloadError}</Alert>}

      <form onSubmit={handleDownload} noValidate>
        {info.passwordProtected && (
          <Field
            label="Mot de passe"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        )}
        <Button type="submit" block disabled={isDownloading}>
          {isDownloading ? 'Téléchargement…' : 'Télécharger'}
        </Button>
      </form>
    </Card>
  );
}
