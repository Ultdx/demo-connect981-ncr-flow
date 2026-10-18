import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { Role } from './gql/graphql';

interface Session {
  role: Role;
  setRole: (role: Role) => void;
}
const SessionContext = createContext<Session>({
  role: Role.Inspector,
  setRole: () => {},
});
export function SessionProvider({ children }: { children: ReactNode }): ReactElement {
  const [role, setRole] = useState<Role>(() => {
    try {
      // Browser storage is untrusted: accept only a known demo persona, never permissions.
      const saved = sessionStorage.getItem('ncr-flow-role');
      return Object.values(Role).find((value) => value === saved) ?? Role.Inspector;
    } catch {
      return Role.Inspector;
    }
  });
  useEffect(() => {
    try {
      // Session storage survives refresh within this tab; authentication remains in HttpOnly cookies.
      sessionStorage.setItem('ncr-flow-role', role);
    } catch {
      // Private/restricted browser modes may disable storage; role switching still works in memory.
    }
  }, [role]);
  return <SessionContext value={{ role, setRole }}>{children}</SessionContext>;
}
export const useSession = (): Session => useContext(SessionContext);
