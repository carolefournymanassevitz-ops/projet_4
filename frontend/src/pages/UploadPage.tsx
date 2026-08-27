import { useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Alert } from '../components/Alert';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Field } from '../components/Field';
import { ApiError } from '../services/http';
import { filesService } from '../services/files.service';
import { copyToClipboard } from '../utils/clipboard';
import { formatBytes } from '../utils/format';
import styles from './forms.module.css';
import homeStyles from './HomePage.module.css';

const EXPIRATION_OPTIONS = [
  { value: 1, label: 'Un jour' },
  { value: 3, label: 'Trois jours' },
  { value: 7, label: 'Une semaine' },
];

type Step = 'select' | 'form' | 'success';

export function UploadPage() {
  const [step, setStep] = useState<Step>('select');
  const [file, setFile] = useState<File | null>(null);
  const [expirationDays, setExpirationDays] = useState(7);
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChosen(event: ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0];
    if (chosen) {
      setFile(chosen);
      setStep('form');
      setError(null);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!file) return;
    if (password && password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const result = await filesService.upload({ file, expirationDays, password: password || undefined });
      // On construit le lien de partage à partir de l'origine courante : le back
      // ne connaît pas l'URL publique du front, il ne renvoie que l'id.
      setDownloadUrl(`${window.location.origin}/d/${result.id}`);
      setStep('success');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Le téléversement a échoué.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCopyLink() {
    if (!downloadUrl) return;

    if (await copyToClipboard(downloadUrl)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      setError('La copie automatique a échoué. Sélectionne le lien ci-dessus pour le copier à la main.');
    }
  }

  function resetToSelection() {
    setFile(null);
    setPassword('');
    setExpirationDays(7);
    setStep('select');
    setDownloadUrl(null);
  }

  if (step === 'select') {
    return (
      <div className={homeStyles.home}>
        <h1 className={homeStyles.title}>Tu veux partager un fichier&nbsp;?</h1>
        <button
          className={homeStyles.uploadButton}
          onClick={() => fileInputRef.current?.click()}
          aria-label="Choisir un fichier à téléverser"
        >
          <span aria-hidden="true">⬆</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileChosen}
          className="sr-only"
          aria-hidden="true"
          tabIndex={-1}
        />
      </div>
    );
  }

  if (step === 'success' && downloadUrl) {
    return (
      <Card title="Ajouter un fichier">
        <Alert variant="success">
          Félicitations, ton fichier sera conservé chez nous pendant{' '}
          {EXPIRATION_OPTIONS.find((o) => o.value === expirationDays)?.label.toLowerCase()} !
        </Alert>
        {error && <Alert variant="error">{error}</Alert>}

        <a className={styles.shareLink} href={downloadUrl}>
          {downloadUrl}
        </a>
        <Button block onClick={handleCopyLink}>
          {copied ? 'Lien copié ✓' : 'Copier le lien'}
        </Button>
      </Card>
    );
  }

  return (
    <Card title="Ajouter un fichier">
      {error && <Alert variant="error">{error}</Alert>}

      <div className={styles.fileSummary}>
        <span aria-hidden="true">📄</span>
        <span className={styles.fileSummaryDetails}>
          <span className={styles.fileName}>{file?.name}</span>
          <span className={styles.fileSize}>{file && formatBytes(file.size)}</span>
        </span>
        <Button type="button" variant="ghost" onClick={resetToSelection}>
          Changer
        </Button>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <Field
          label="Mot de passe"
          optional
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hint="6 caractères minimum si renseigné"
        />
        <Field
          label="Expiration"
          control={
            <select
              className={styles.select}
              value={expirationDays}
              onChange={(e) => setExpirationDays(Number(e.target.value))}
            >
              {EXPIRATION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          }
        />
        <Button type="submit" block disabled={isSubmitting}>
          {isSubmitting ? 'Téléversement…' : 'Téléverser'}
        </Button>
      </form>
    </Card>
  );
}
