import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { authService, type Credentials } from '../services/auth.service';
import { ApiError, TOKEN_STORAGE_KEY } from '../services/http';

const USER_STORAGE_KEY = 'datashare.user';

export type AuthUser = {
  id: string;
  email: string;
};

type AuthState = {
  token: string | null;
  user: AuthUser | null;
  status: 'idle' | 'loading' | 'failed';
  error: string | null;
};

/** Réhydrate la session depuis localStorage : rester connecté après un F5. */
function loadPersistedState(): Pick<AuthState, 'token' | 'user'> {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  const rawUser = localStorage.getItem(USER_STORAGE_KEY);
  return {
    token,
    user: rawUser ? (JSON.parse(rawUser) as AuthUser) : null,
  };
}

const initialState: AuthState = {
  ...loadPersistedState(),
  status: 'idle',
  error: null,
};

/** Convertit une erreur technique en message affichable. */
function toMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Une erreur inattendue est survenue.';
}

export const login = createAsyncThunk('auth/login', async (credentials: Credentials, { rejectWithValue }) => {
  try {
    return await authService.login(credentials);
  } catch (error) {
    return rejectWithValue(toMessage(error));
  }
});

export const register = createAsyncThunk('auth/register', async (credentials: Credentials, { rejectWithValue }) => {
  try {
    await authService.register(credentials);
    // Inscription réussie : on enchaîne sur la connexion pour éviter
    // à l'utilisateur de ressaisir ses identifiants.
    return await authService.login(credentials);
  } catch (error) {
    return rejectWithValue(toMessage(error));
  }
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout(state) {
      state.token = null;
      state.user = null;
      state.error = null;
      state.status = 'idle';
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      localStorage.removeItem(USER_STORAGE_KEY);
    },
    clearError(state) {
      state.error = null;
      state.status = 'idle';
    },
  },
  extraReducers(builder) {
    builder
      .addMatcher(
        (action) => action.type.startsWith('auth/') && action.type.endsWith('/pending'),
        (state) => {
          state.status = 'loading';
          state.error = null;
        },
      )
      .addMatcher(
        (action) => action.type.startsWith('auth/') && action.type.endsWith('/fulfilled'),
        (state, action: { payload: { token: string; userId: string; email: string } }) => {
          const { token, userId, email } = action.payload;
          state.status = 'idle';
          state.token = token;
          state.user = { id: userId, email };
          localStorage.setItem(TOKEN_STORAGE_KEY, token);
          localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(state.user));
        },
      )
      .addMatcher(
        (action) => action.type.startsWith('auth/') && action.type.endsWith('/rejected'),
        (state, action: { payload?: string }) => {
          state.status = 'failed';
          state.error = action.payload ?? 'Une erreur inattendue est survenue.';
        },
      );
  },
});

export const { logout, clearError } = authSlice.actions;
export default authSlice.reducer;
