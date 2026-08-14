import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAppSelector } from '../store/hooks';
import { selectIsAuthenticated } from '../store/selectors';

type ProtectedRouteProps = {
  children: ReactNode;
};

/** Garde de route : renvoie vers /connexion si aucun utilisateur n'est authentifié
 *  (US01/US05/US06 sont réservées aux comptes). */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/connexion" replace />;
}
