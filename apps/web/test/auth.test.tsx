// @vitest-environment jsdom
import { testCredentials } from '../../api/test/credentials';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AuthProvider } from '../src/auth';
import { authClient, sessionExpiredEvent } from '../src/authClient';
import { SessionProvider } from '../src/session';
import { App } from '../src/App';

vi.mock('../src/pages/Operations', () => ({ Operations: () => <p>Protected operations</p> }));
vi.mock('../src/pages/NcrDetail', () => ({ NcrDetail: () => <p>Protected NCR detail</p> }));
vi.mock('../src/pages/LotThread', () => ({ LotThread: () => <p>Protected material thread</p> }));
vi.mock('../src/pages/CreateNcr', () => ({ CreateNcr: () => <p>Protected creation form</p> }));

const session = vi.spyOn(authClient, 'session');
const login = vi.spyOn(authClient, 'login');
const logout = vi.spyOn(authClient, 'logout');

function renderApp(strict = false): ReturnType<typeof render> {
  return render(
    <AuthProvider>
      <SessionProvider>
        <App />
      </SessionProvider>
    </AuthProvider>,
    { reactStrictMode: strict },
  );
}

beforeEach(() => {
  session.mockReset().mockResolvedValue(null);
  login.mockReset();
  logout.mockReset();
  window.location.hash = '#/';
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe('demo sign-in interface', () => {
  it.each([null, testCredentials.username])(
    'loads branding from the hosted base for session %s',
    async (username) => {
      vi.stubEnv('BASE_URL', '/dev/demo/connect-981/');
      session.mockResolvedValueOnce(username);
      renderApp();
      const logo = await screen.findByRole('img', { name: 'Connect981' });
      expect(logo.getAttribute('src')).toBe('/dev/demo/connect-981/brand/connect981-logo.svg');
    },
  );

  it('waits for API session verification before mounting protected screens', async () => {
    let resolve!: (username: string | null) => void;
    session.mockReturnValueOnce(
      new Promise<string | null>((complete) => {
        resolve = complete;
      }),
    );
    renderApp();
    expect(screen.getByRole('status').textContent).toBe('Checking your session…');
    expect(screen.queryByText('Protected operations')).toBeNull();
    await act(async () => resolve(null));
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Username' }).value).toBe('');
    expect(screen.getByLabelText<HTMLInputElement>('Password').value).toBe('');
    expect(screen.getByLabelText('Password').getAttribute('type')).toBe('password');
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Sign in' }).disabled).toBe(true);
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('shows credential errors and opens the workspace after a successful retry', async () => {
    login
      .mockRejectedValueOnce(new Error('Invalid username or password.'))
      .mockResolvedValueOnce(testCredentials.username);
    renderApp();
    await screen.findByRole('button', { name: 'Sign in' });
    fireEvent.change(screen.getByRole('textbox', { name: 'Username' }), {
      target: { value: testCredentials.username },
    });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Invalid username or password.',
    );
    expect(screen.queryByText('Protected operations')).toBeNull();
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: testCredentials.password },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await screen.findByText('Protected operations');
    expect(login).toHaveBeenLastCalledWith(testCredentials.username, testCredentials.password);
    expect(screen.getByRole('combobox', { name: 'Demo role' })).toBeTruthy();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(1);
    expect(sessionStorage.getItem('ncr-flow-role')).toBe('INSPECTOR');
  });

  it('prevents repeated submissions while login is pending', async () => {
    let resolve!: (username: string) => void;
    login.mockReturnValueOnce(
      new Promise<string>((complete) => {
        resolve = complete;
      }),
    );
    renderApp();
    await screen.findByRole('button', { name: 'Sign in' });
    fireEvent.change(screen.getByLabelText('Username'), {
      target: { value: testCredentials.username },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: testCredentials.password },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Signing in…' }).disabled).toBe(
      true,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Signing in…' }));
    expect(login).toHaveBeenCalledOnce();
    await act(async () => resolve(testCredentials.username));
    expect(screen.getByText('Protected operations')).toBeTruthy();
  });

  it('restores an existing session and signs out through the API', async () => {
    session.mockResolvedValueOnce(testCredentials.username);
    logout.mockResolvedValueOnce();
    renderApp();
    await screen.findByText('Protected operations');
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    await screen.findByRole('button', { name: 'Sign in' });
    expect(logout).toHaveBeenCalledOnce();
    expect(screen.queryByText('Protected operations')).toBeNull();
  });

  it('retains the workspace and shows feedback if logout fails', async () => {
    session.mockResolvedValueOnce(testCredentials.username);
    logout.mockRejectedValueOnce(new Error('Unable to sign out. Please try again.'));
    renderApp();
    await screen.findByText('Protected operations');
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Unable to sign out. Please try again.',
    );
    expect(screen.getByText('Protected operations')).toBeTruthy();
  });

  it('returns to login on expiry and preserves the requested record after reauthentication', async () => {
    window.location.hash = '#/ncr/000000070000000000000001';
    session.mockResolvedValueOnce(testCredentials.username);
    login.mockResolvedValueOnce(testCredentials.username);
    renderApp();
    await screen.findByText('Protected NCR detail');
    act(() => window.dispatchEvent(new Event(sessionExpiredEvent)));
    expect(screen.queryByText('Protected NCR detail')).toBeNull();
    expect(screen.getByRole('alert').textContent).toBe(
      'Your session has expired. Please sign in again.',
    );
    fireEvent.change(screen.getByLabelText('Username'), {
      target: { value: testCredentials.username },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: testCredentials.password },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await screen.findByText('Protected NCR detail');
  });

  it('allows login recovery after the initial session probe fails', async () => {
    session.mockRejectedValueOnce(new TypeError('Failed to fetch.'));
    login.mockResolvedValueOnce(testCredentials.username);
    renderApp();
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Failed to fetch.');
    fireEvent.change(screen.getByLabelText('Username'), {
      target: { value: testCredentials.username },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: testCredentials.password },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await screen.findByText('Protected operations');
  });

  it('ignores the abandoned session probe during StrictMode remounting', async () => {
    let resolve!: (username: string | null) => void;
    session
      .mockReturnValueOnce(
        new Promise<string | null>((complete) => {
          resolve = complete;
        }),
      )
      .mockResolvedValueOnce(testCredentials.username);
    renderApp(true);
    await screen.findByText('Protected operations');
    expect(session).toHaveBeenCalledTimes(2);
    expect(session.mock.calls[0]?.[0]?.aborted).toBe(true);
    await act(async () => resolve(null));
    expect(screen.getByText('Protected operations')).toBeTruthy();
  });
});
