import { Presentation } from './Presentation';
import { useEffect, useState, type ReactElement } from 'react';
import { Role } from './gql/graphql';
import { useSession } from './session';

import { Operations } from './pages/Operations';
import { NcrDetail } from './pages/NcrDetail';
import { LotThread } from './pages/LotThread';
import { CreateNcr } from './pages/CreateNcr';
import { useAuth } from './auth';
import { Login } from './pages/Login';
import { ApiClient } from './api';
import './styles.css';

export function App(): ReactElement {
  const [hash, setHash] = useState(window.location.hash);
  const { role, setRole } = useSession();
  const { username, checking, logout } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  useEffect(() => {
    const navigate = (): void => setHash(window.location.hash);
    window.addEventListener('hashchange', navigate);
    return () => window.removeEventListener('hashchange', navigate);
  }, []);
  async function signOut(): Promise<void> {
    if (signingOut) return;
    setSigningOut(true);
    setLogoutError('');
    try {
      await logout();
      setRole(Role.Inspector);
    } catch (cause) {
      setLogoutError(ApiClient.errorMessage(cause));
    } finally {
      setSigningOut(false);
    }
  }
  if (checking)
    return (
      <main>
        <p className="notice" role="status">
          Checking your session…
        </p>
      </main>
    );
  // Demo only: protected screens mount after the API confirms the cookie session.
  if (!username) return <Login />;
  const [page, rawParameter = ''] = hash.replace(/^#\/?/, '').split('/');
  let parameter = '';
  try {
    parameter = decodeURIComponent(rawParameter);
  } catch {
    /* Invalid hash input renders the not-found state below. */
  }
  const content =
    page === 'ncr' && /^[a-f\d]{24}$/i.test(parameter) ? (
      <NcrDetail id={parameter} key={parameter} />
    ) : page === 'lot' ? (
      <LotThread lotNumber={parameter || 'LOT-EL-2291'} key={parameter} />
    ) : page === 'new' ? (
      <CreateNcr />
    ) : !page ? (
      <Operations />
    ) : (
      <p className="notice">
        Page not found. <a href="#/">Return to operations.</a>
      </p>
    );
  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="#/" aria-label="Connect981 — NCR Flow operations">
          <img
            className="brand-logo"
            src={`${import.meta.env.BASE_URL}brand/connect981-logo.svg`}
            alt="Connect981"
            width="151"
            height="31"
          />
          <span className="brand-divider" aria-hidden="true" />
          <span className="brand-product">NCR Flow</span>
        </a>
        <nav aria-label="Main navigation">
          <a className={!page ? 'active' : ''} href="#/">
            Operations
          </a>
          <a className={page === 'lot' ? 'active' : ''} href="#/lot/LOT-EL-2291">
            Digital thread
          </a>
        </nav>
        <label className="role-picker">
          <span>Demo role</span>
          <select value={role} onChange={(event) => setRole(event.target.value as Role)}>
            {Object.values(Role).map((value) => (
              <option key={value} value={value}>
                {Presentation.label(value)}
              </option>
            ))}
          </select>
        </label>
        <button
          className="secondary sign-out"
          type="button"
          disabled={signingOut}
          onClick={() => void signOut()}
        >
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </header>
      <div className="demo-strip">
        <span className="status-dot" />
        <span>AeroSeal Industries · LYO + MTL</span>
        <span className="push-right">Demo workspace · Fictional data</span>
      </div>
      <main>
        {logoutError && (
          <p className="error" role="alert">
            {logoutError}
          </p>
        )}
        {content}
      </main>
      <footer>
        <a href="https://connect981.com/" target="_blank" rel="noreferrer">
          Connect981 <span aria-hidden="true">↗</span>
        </a>
      </footer>
    </div>
  );
}
