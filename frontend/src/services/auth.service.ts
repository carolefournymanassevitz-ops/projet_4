import { request } from './http';

export type Credentials = {
  email: string;
  password: string;
};

export type AuthResult = {
  token: string;
  expiresIn: number;
  userId: string;
  email: string;
};

export const authService = {
  register(credentials: Credentials): Promise<void> {
    return request<void>('/auth/register', { method: 'POST', body: credentials, auth: false });
  },

  login(credentials: Credentials): Promise<AuthResult> {
    return request<AuthResult>('/auth/login', { method: 'POST', body: credentials, auth: false });
  },
};
