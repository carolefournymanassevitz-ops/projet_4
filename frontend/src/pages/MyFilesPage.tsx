import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert } from '../components/Alert';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { FileRow } from '../components/FileRow';
import { ApiError } from '../services/http';
import { filesService, type FileHistoryItem } from '../services/files.service';
import { copyToClipboard } from '../utils/clipboard';
import styles from './MyFilesPage.module.css';

type Tab = 'active' | 'expired';

export function MyFilesPage() {
  const [files, setFiles] = useState<FileHistoryItem[]>([]);
  const [tab, setTab] = useState<Tab>('active');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadFiles();
  }, []);

  async function loadFiles() {
    setIsLoading(true);
    setError(null);
    try {
      setFiles(await filesService.list());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de charger tes fichiers.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete(id: string) {
    // US06 : confirmation obligatoire côté front avant une suppression irréversible.
    const file = files.find((f) => f.id === id);
    if (!window.confirm(`Supprimer définitivement « ${file?.originalFilename} » ?`)) {
      return;
    }
    try {
      await filesService.remove(id);
      setFiles((current) => current.filter((f) => f.id !== id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'La suppression a échoué.');
    }
  }

  async function handleCopyLink(id: string) {
    if (await copyToClipboard(`${window.location.origin}/d/${id}`)) {
      // Retour visuel temporaire sur la ligne concernée : sans ça, l'utilisateur
      // ne sait pas si son clic a fait quelque chose.
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } else {
      setError('La copie du lien a échoué. Ouvre le fichier pour récupérer son lien.');
    }
  }

  const visibleFiles = useMemo(
    () => files.filter((f) => (tab === 'active' ? !f.expired : f.expired)),
    [files, tab],
  );

  return (
    <Card title="Mes fichiers" wide>
      <div className={styles.headerRow}>
        <div className={styles.tabs} role="tablist" aria-label="Filtrer par statut">
          <button
            role="tab"
            aria-selected={tab === 'active'}
            className={`${styles.tab} ${tab === 'active' ? styles.tabActive : ''}`}
            onClick={() => setTab('active')}
          >
            Actifs
          </button>
          <button
            role="tab"
            aria-selected={tab === 'expired'}
            className={`${styles.tab} ${tab === 'expired' ? styles.tabActive : ''}`}
            onClick={() => setTab('expired')}
          >
            Expirés
          </button>
        </div>
        <Button onClick={() => navigate('/televersement')}>Ajouter un fichier</Button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {isLoading ? (
        <p className={styles.empty}>Chargement…</p>
      ) : visibleFiles.length === 0 ? (
        <p className={styles.empty}>
          {tab === 'active' ? "Aucun fichier actif pour l'instant." : 'Aucun fichier expiré.'}
        </p>
      ) : (
        <ul className={styles.list}>
          {visibleFiles.map((file) => (
            <FileRow
              key={file.id}
              file={file}
              onDelete={handleDelete}
              onCopyLink={handleCopyLink}
              copied={copiedId === file.id}
            />
          ))}
        </ul>
      )}
    </Card>
  );
}
