import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '../store/hooks';
import { selectIsAuthenticated } from '../store/selectors';
import styles from './HomePage.module.css';

export function HomePage() {
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const navigate = useNavigate();

  // L'upload est réservé aux comptes (US01) : on redirige vers la connexion si besoin.
  function handleClick() {
    navigate(isAuthenticated ? '/televersement' : '/connexion');
  }

  return (
    <div className={styles.home}>
      <h1 className={styles.title}>Tu veux partager un fichier&nbsp;?</h1>
      <button className={styles.uploadButton} onClick={handleClick} aria-label="Téléverser un fichier">
        <span aria-hidden="true">⬆</span>
      </button>
    </div>
  );
}
