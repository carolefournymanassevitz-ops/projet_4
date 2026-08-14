import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert } from '../components/Alert';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Field } from '../components/Field';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { clearError, login } from '../store/authSlice';
import { selectAuthError, selectAuthStatus, selectIsAuthenticated } from '../store/selectors';
import styles from './forms.module.css';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const status = useAppSelector(selectAuthStatus);
  const error = useAppSelector(selectAuthError);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);

  // On efface une éventuelle erreur laissée par un écran précédent.
  useEffect(() => {
    dispatch(clearError());
  }, [dispatch]);

  // Dès que la connexion réussit, on redirige vers l'espace personnel.
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/mes-fichiers');
    }
  }, [isAuthenticated, navigate]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    dispatch(login({ email, password }));
  }

  return (
    <Card title="Connexion">
      {error && <Alert variant="error">{error}</Alert>}

      <form onSubmit={handleSubmit} noValidate>
        <Field
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
        <Field
          label="Mot de passe"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
        <Button type="submit" block disabled={status === 'loading'}>
          {status === 'loading' ? 'Connexion…' : 'Se connecter'}
        </Button>
      </form>

      <p className={styles.footerLink}>
        Pas encore de compte ? <Link to="/inscription">Créer un compte</Link>
      </p>
    </Card>
  );
}
