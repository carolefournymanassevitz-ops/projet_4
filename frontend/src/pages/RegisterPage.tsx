import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert } from '../components/Alert';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Field } from '../components/Field';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { clearError, register } from '../store/authSlice';
import { selectAuthError, selectAuthStatus, selectIsAuthenticated } from '../store/selectors';
import styles from './forms.module.css';

const MIN_PASSWORD_LENGTH = 8;

export function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // Validation côté client, en complément de celle du serveur (exigence du cahier des charges).
  const [localError, setLocalError] = useState<string | null>(null);

  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const status = useAppSelector(selectAuthStatus);
  const serverError = useAppSelector(selectAuthError);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);

  useEffect(() => {
    dispatch(clearError());
  }, [dispatch]);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/mes-fichiers');
    }
  }, [isAuthenticated, navigate]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (password.length < MIN_PASSWORD_LENGTH) {
      setLocalError(`Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`);
      return;
    }
    setLocalError(null);
    dispatch(register({ email, password }));
  }

  const error = localError ?? serverError;

  return (
    <Card title="Créer un compte">
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
          autoComplete="new-password"
          hint={`${MIN_PASSWORD_LENGTH} caractères minimum`}
          required
        />
        <Button type="submit" block disabled={status === 'loading'}>
          {status === 'loading' ? 'Création…' : 'Créer mon compte'}
        </Button>
      </form>

      <p className={styles.footerLink}>
        Déjà inscrit ? <Link to="/connexion">Se connecter</Link>
      </p>
    </Card>
  );
}
