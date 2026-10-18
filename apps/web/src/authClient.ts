import { z } from 'zod';
import { ApiEndpoint } from './ApiEndpoint';

export const sessionExpiredEvent = 'ncr-session-expired';
const sessionSchema = z.object({ username: z.string().min(1) });
const errorSchema = z.object({ message: z.string() });

/** Demo-only authentication client; credentials and session tokens are never persisted in JS. */
export class AuthClient {
  private async username(response: Response): Promise<string> {
    const body = await response.json();
    if (!response.ok) {
      const error = errorSchema.safeParse(body);
      throw new Error(error.success ? error.data.message : 'Unable to sign in. Please try again.');
    }
    return sessionSchema.parse(body).username;
  }

  async session(signal?: AbortSignal): Promise<string | null> {
    const response = await fetch(ApiEndpoint.url('auth/session'), {
      credentials: 'include',
      cache: 'no-store',
      signal,
    });
    if (response.status === 401) return null;
    return this.username(response);
  }

  async login(username: string, password: string): Promise<string> {
    const response = await fetch(ApiEndpoint.url('auth/login'), {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    return this.username(response);
  }

  async logout(): Promise<void> {
    const response = await fetch(ApiEndpoint.url('auth/logout'), {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (!response.ok) throw new Error('Unable to sign out. Please try again.');
  }
}
export const authClient = new AuthClient();
