/** Shares API URL resolution between GraphQL and cookie-session requests. */
export class ApiEndpoint {
  static url(path: 'graphql' | 'auth/session' | 'auth/login' | 'auth/logout'): string {
    // An explicit API URL is independent of the frontend's asset/navigation base.
    // Empty configuration keeps the same-origin local and Docker proxies working.
    const configured = import.meta.env.VITE_API_URL || import.meta.env.BASE_URL;
    const base = new URL(
      configured.endsWith('/') ? configured : `${configured}/`,
      window.location.origin,
    );
    if (!['http:', 'https:'].includes(base.protocol))
      throw new Error('The API URL must use HTTP or HTTPS.');
    return new URL(path, base).href;
  }
}
