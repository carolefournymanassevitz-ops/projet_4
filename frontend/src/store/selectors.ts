import type { RootState } from './index';

/** Les composants passent par ces sélecteurs plutôt que de fouiller state.auth.x
 *  directement : si la forme du store change, un seul fichier est impacté. */
export const selectToken = (state: RootState) => state.auth.token;
export const selectUser = (state: RootState) => state.auth.user;
export const selectIsAuthenticated = (state: RootState) => state.auth.token !== null;
export const selectAuthStatus = (state: RootState) => state.auth.status;
export const selectAuthError = (state: RootState) => state.auth.error;
