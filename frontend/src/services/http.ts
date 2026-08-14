export const TOKEN_STORAGE_KEY = 'datashare.token';

/**
 * Erreur métier remontée par l'API, avec le code HTTP et un message
 * déjà traduit pour l'utilisateur final.
 */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  auth?: boolean;
};

/** Traduit un code HTTP en message compréhensible, en dernier recours. */
function defaultMessageFor(status: number): string {
  switch (status) {
    case 400:
      return 'Les informations envoyées sont invalides.';
    case 401:
      return 'Identifiants incorrects ou session expirée.';
    case 403:
      return "Vous n'avez pas accès à cette ressource.";
    case 404:
      return 'Ressource introuvable.';
    case 409:
      return 'Cette adresse email est déjà utilisée.';
    case 410:
      return 'Ce lien a expiré.';
    case 413:
      return 'Le fichier est trop volumineux (1 Go maximum).';
    default:
      return status >= 500
        ? 'Le service est momentanément indisponible. Réessayez plus tard.'
        : 'Une erreur est survenue.';
  }
}

function authHeader(): Record<string, string> {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Extrait le message d'erreur renvoyé par l'API, sinon un message par défaut. */
async function toApiError(response: Response): Promise<ApiError> {
  let message = '';
  try {
    const payload = await response.json();
    message = payload?.message ?? payload?.error ?? '';
  } catch {
    // corps vide ou non JSON : on garde le message par défaut
  }
  return new ApiError(response.status, message || defaultMessageFor(response.status));
}

/** Requête JSON (cas général). */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true } = options;

  const response = await fetch(`/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(auth ? authHeader() : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    throw await toApiError(response);
  }

  // 204 No Content (suppression) : pas de corps à parser
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

/** Requête multipart (upload de fichier) : pas de Content-Type manuel,
 *  le navigateur doit générer lui-même la boundary. */
export async function upload<T>(path: string, formData: FormData): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method: 'POST',
    headers: authHeader(),
    body: formData,
  });

  if (!response.ok) {
    throw await toApiError(response);
  }
  return (await response.json()) as T;
}

/** Requête renvoyant un flux binaire (téléchargement). */
export async function requestBlob(path: string, body?: unknown): Promise<Blob> {
  const response = await fetch(`/api${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });

  if (!response.ok) {
    throw await toApiError(response);
  }
  return await response.blob();
}
