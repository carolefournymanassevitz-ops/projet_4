import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from './Button';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { selectIsAuthenticated } from '../store/selectors';
import { logout } from '../store/authSlice';
import styles from './Layout.module.css';

type LayoutProps = {
  children: ReactNode;
};

export function Layout({ children }: LayoutProps) {
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  function handleLogout() {
    dispatch(logout());
    navigate('/');
  }

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <Link to="/" className={styles.brand}>
          DataShare
        </Link>
        <nav className={styles.actions} aria-label="Navigation principale">
          {isAuthenticated ? (
            <>
              <Button variant="dark" onClick={() => navigate('/mes-fichiers')}>
                Mon espace
              </Button>
              <Button variant="dark" onClick={handleLogout}>
                Se déconnecter
              </Button>
            </>
          ) : (
            <Button variant="dark" onClick={() => navigate('/connexion')}>
              Se connecter
            </Button>
          )}
        </nav>
      </header>

      <main className={styles.main}>{children}</main>

      <footer className={styles.footer}>Copyright DataShare® 2026</footer>
    </div>
  );
}
