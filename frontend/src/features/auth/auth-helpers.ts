import { Strings } from '@/constants/strings';

interface RegisterFields {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: string;
}

/**
 * Body for POST /auth/register.
 *
 * `username` is deliberately NOT sent: the backend DTO marks it optional and falls back to the
 * full (trimmed) email, which is already unique. Deriving it client-side from the email
 * local-part (`dana` from `dana@a.com`) collided across users with different domains (BUG-07).
 * Login still accepts the email as the "username", so nothing else depends on the old value.
 */
export function buildRegisterPayload({ email, password, firstName, lastName, role }: RegisterFields) {
  return { email: email.trim(), password, firstName, lastName, role };
}

const HEBREW_RE = /[֐-׿]/;

/**
 * Turns a failed login/register request into a Hebrew, user-facing message. Backend messages are
 * mostly English ("Username or email already exists"), so known statuses are mapped; a Hebrew
 * server message (e.g. the Google-only-account hint on login) is passed through as-is.
 */
export function getAuthErrorMessage(err: any, isLogin: boolean): string {
  const response = err?.response;
  if (!response) return Strings.auth.networkError;

  const status: number | undefined = response.status;
  const raw = response.data?.message;
  const serverMessage = Array.isArray(raw) ? raw.join(', ') : raw;

  if (typeof serverMessage === 'string' && HEBREW_RE.test(serverMessage)) return serverMessage;
  if (status === 409) return Strings.auth.emailExistsError;
  if (status === 401 && isLogin) return Strings.auth.invalidCredentialsError;
  return Strings.auth.genericError;
}
