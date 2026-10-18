// @vitest-environment jsdom
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SessionProvider, useSession } from '../src/session';
import { Role } from '../src/gql/graphql';

function RoleControl(): ReactElement {
  const { role, setRole } = useSession();
  return (
    <select
      aria-label="Role"
      value={role}
      onChange={(event) => setRole(event.target.value as Role)}
    >
      {Object.values(Role).map((value) => (
        <option key={value} value={value}>
          {value}
        </option>
      ))}
    </select>
  );
}

beforeEach(() => sessionStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('demo persona persistence', () => {
  it('restores the selected role after remounting the application', () => {
    const view = render(
      <SessionProvider>
        <RoleControl />
      </SessionProvider>,
    );
    fireEvent.change(screen.getByRole('combobox'), { target: { value: Role.Engineering } });
    expect(sessionStorage.getItem('ncr-flow-role')).toBe(Role.Engineering);
    view.unmount();
    render(
      <SessionProvider>
        <RoleControl />
      </SessionProvider>,
    );
    expect(screen.getByRole<HTMLSelectElement>('combobox').value).toBe(Role.Engineering);
  });

  it('rejects an invalid stored role', () => {
    sessionStorage.setItem('ncr-flow-role', 'ADMIN');
    render(
      <SessionProvider>
        <RoleControl />
      </SessionProvider>,
    );
    expect(screen.getByRole<HTMLSelectElement>('combobox').value).toBe(Role.Inspector);
  });

  it('keeps role switching usable when browser storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Storage blocked.', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage blocked.', 'SecurityError');
    });
    render(
      <SessionProvider>
        <RoleControl />
      </SessionProvider>,
    );
    fireEvent.change(screen.getByRole('combobox'), { target: { value: Role.Quality } });
    expect(screen.getByRole<HTMLSelectElement>('combobox').value).toBe(Role.Quality);
  });
});
