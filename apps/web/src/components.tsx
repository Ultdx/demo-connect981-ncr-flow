import type { ReactElement, ReactNode } from 'react';
import { Presentation } from './Presentation';

export const Badge = ({ value }: { value: string }): ReactElement => (
  <span className={`badge badge-${value.toLowerCase()}`}>{Presentation.label(value)}</span>
);
export function QueryState({
  loading,
  error,
  children,
}: {
  loading: boolean;
  error: string;
  children: ReactNode;
}): ReactElement {
  if (loading)
    return (
      <p className="notice" role="status">
        Loading operational data…
      </p>
    );
  if (error)
    return (
      <div className="error" role="alert">
        <strong>Unable to load data.</strong>
        <p>{error}</p>
        <p>Check that the API and MongoDB are running.</p>
      </div>
    );
  return <>{children}</>;
}
