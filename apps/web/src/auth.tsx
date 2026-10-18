import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { authClient, sessionExpiredEvent } from './authClient';
import { ApiClient } from './api';

interface AuthState {
  username: string | null;
  checking: boolean;
  error: string;
}
interface AuthSession extends AuthState {
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}
const AuthContext = createContext<AuthSession | null>(null);

export function AuthProvider({ children }: { children: ReactNode }): ReactElement {
  const [state, setState] = useState<AuthState>({ username: null, checking: true, error: '' });
  useEffect(() => {
    const controller = new AbortController();
    authClient
      .session(controller.signal)
      .then((username) => {
        if (!controller.signal.aborted) setState({ username, checking: false, error: '' });
      })
      // eslint-disable-next-line @typescript-eslint/no-restricted-types -- Narrow untrusted transport rejection values at the shared error boundary.
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setState({ username: null, checking: false, error: ApiClient.errorMessage(cause) });
      });
    const expired = (): void => {
      controller.abort();
      setState({
        username: null,
        checking: false,
        error: 'Your session has expired. Please sign in again.',
      });
    };
    window.addEventListener(sessionExpiredEvent, expired);
    return () => {
      controller.abort();
      window.removeEventListener(sessionExpiredEvent, expired);
    };
  }, []);

  async function login(username: string, password: string): Promise<void> {
    const signedIn = await authClient.login(username, password);
    setState({ username: signedIn, checking: false, error: '' });
  }
  async function logout(): Promise<void> {
    await authClient.logout();
    setState({ username: null, checking: false, error: '' });
  }
  return <AuthContext value={{ ...state, login, logout }}>{children}</AuthContext>;
}

export function useAuth(): AuthSession {
  const session = useContext(AuthContext);
  if (!session) throw new Error('AuthProvider is required.');
  return session;
}
