import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { GraphQLError } from 'graphql';
import { z } from 'zod';
import { ApiConfig } from '../config.js';

const credentialsSchema = z
  .object({
    username: z.string().min(1).max(80),
    password: z.string().min(1).max(128),
  })
  .strict();
const sessionSeconds = 8 * 60 * 60;
const cookieName = 'ncr_demo_session';

/** Demo only: one shared account and process-local sessions, not a production identity system. */
export class DemoAuth {
  // Demo-only credentials come from the API environment and never enter the web bundle.
  private readonly credentialsDigest: Buffer;
  private readonly sessions = new Map<string, number>();
  private failedAttempts = 0;
  private attemptWindowEnds = 0;

  constructor(private readonly config: ApiConfig) {
    const { DEMO_USERNAME, DEMO_PASSWORD } = config.values;
    this.credentialsDigest = createHash('sha256')
      .update(`${DEMO_USERNAME}\0${DEMO_PASSWORD}`)
      .digest();
  }

  private token(request: Request): string | undefined {
    const token = request.headers
      .get('cookie')
      ?.split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${cookieName}=`))
      ?.slice(cookieName.length + 1);
    return token && /^[a-f\d]{64}$/.test(token) ? token : undefined;
  }

  user(request: Request): string | null {
    const token = this.token(request);
    if (!token) return null;
    const expiry = this.sessions.get(token);
    if (!expiry || expiry <= Date.now()) {
      this.sessions.delete(token);
      return null;
    }
    return this.config.values.DEMO_USERNAME;
  }

  requireUser(request: Request): string {
    const username = this.user(request);
    if (!username)
      throw new GraphQLError('Sign in to access the demo.', {
        extensions: { code: 'UNAUTHENTICATED', http: { status: 401 } },
      });
    return username;
  }

  private cookie(token: string, maxAge: number): string {
    return `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${this.config.values.AUTH_COOKIE_SECURE ? '; Secure' : ''}`;
  }

  private allowedOrigin(origin: string, url: URL): boolean {
    // Hosted mode has one exact browser origin; do not trust arbitrary subdomains.
    if (this.config.values.FRONTEND_ORIGIN) return origin === this.config.values.FRONTEND_ORIGIN;
    // Local same-origin proxies can terminate HTTPS before forwarding to Node.
    try {
      return new URL(origin).host === url.host;
    } catch {
      return false;
    }
  }

  cors(request: Request, headers: Headers): void {
    headers.append('Vary', 'Origin');
    const origin = request.headers.get('origin');
    if (!origin || !this.allowedOrigin(origin, new URL(request.url))) return;
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Credentials', 'true');
    headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type, X-Role');
    headers.set('Access-Control-Max-Age', '600');
  }

  async handle(request: Request, url: URL): Promise<Response | undefined> {
    const path = url.pathname.replace(/\/+$/, '');
    const headers = new Headers({ 'Cache-Control': 'no-store' });
    if (path !== '/graphql' && !path.startsWith('/auth/')) return undefined;

    // Validate origins for both reads and writes before checking cookies. REST
    // authentication and GraphQL share the same CORS/CSRF policy.
    const origin = request.headers.get('origin');
    if (origin && !this.allowedOrigin(origin, url))
      return Response.json(
        { message: 'Cross-origin requests are not allowed.' },
        { status: 403, headers },
      );

    // Browser preflight has no session cookie. Approve only the methods/headers
    // used by this demo, then require authentication on the actual GraphQL call.
    if (request.method === 'OPTIONS') {
      const method = request.headers.get('access-control-request-method') ?? 'GET';
      const requestedHeaders = (request.headers.get('access-control-request-headers') ?? '')
        .split(',')
        .map((name) => name.trim().toLowerCase())
        .filter(Boolean);
      if (
        !['GET', 'POST'].includes(method) ||
        requestedHeaders.some((name) => !['content-type', 'x-role'].includes(name))
      )
        return Response.json(
          { message: 'This cross-origin request is not allowed.' },
          { status: 403, headers },
        );
      return new Response(null, { status: 204, headers });
    }

    if (path === '/graphql') {
      if (!this.user(request))
        return Response.json(
          {
            errors: [
              {
                message: 'Sign in to access the demo.',
                extensions: { code: 'UNAUTHENTICATED' },
              },
            ],
          },
          { status: 401, headers },
        );
      return undefined;
    }

    const method = path === '/auth/session' ? 'GET' : 'POST';
    if (!['/auth/login', '/auth/session', '/auth/logout'].includes(path))
      return Response.json({ message: 'Not found.' }, { status: 404, headers });
    if (request.method !== method) {
      headers.set('Allow', method);
      return Response.json({ message: 'Method not allowed.' }, { status: 405, headers });
    }
    if (path === '/auth/session') {
      const username = this.user(request);
      return Response.json(username ? { username } : { message: 'Sign in to access the demo.' }, {
        status: username ? 200 : 401,
        headers,
      });
    }
    if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))
      return Response.json({ message: 'Send a JSON request.' }, { status: 415, headers });
    if (path === '/auth/logout') {
      const token = this.token(request);
      if (token) this.sessions.delete(token);
      headers.set('Set-Cookie', this.cookie('', 0));
      return Response.json({ message: 'Signed out.' }, { headers });
    }

    const now = Date.now();
    // A bounded, process-local throttle is sufficient for this single-account demo.
    if (now >= this.attemptWindowEnds) {
      this.failedAttempts = 0;
      this.attemptWindowEnds = now + 60_000;
    }
    if (this.failedAttempts >= 10) {
      headers.set('Retry-After', String(Math.ceil((this.attemptWindowEnds - now) / 1000)));
      return Response.json(
        { message: 'Too many attempts. Try again in one minute.' },
        { status: 429, headers },
      );
    }
    let credentials: z.infer<typeof credentialsSchema>;
    try {
      credentials = credentialsSchema.parse(await request.json());
    } catch {
      this.failedAttempts += 1;
      return Response.json({ message: 'Enter a username and password.' }, { status: 400, headers });
    }
    // Equal-length digests allow a timing-safe comparison of the configured demo pair.
    // This is credential verification for a fixture, not password storage/hashing.
    const digest = createHash('sha256')
      .update(`${credentials.username}\0${credentials.password}`)
      .digest();
    if (!timingSafeEqual(digest, this.credentialsDigest)) {
      this.failedAttempts += 1;
      return Response.json({ message: 'Invalid username or password.' }, { status: 401, headers });
    }
    for (const [token, expiry] of this.sessions) if (expiry <= now) this.sessions.delete(token);
    const previous = this.token(request);
    if (previous) this.sessions.delete(previous);
    if (this.sessions.size >= 500)
      return Response.json(
        { message: 'Too many active sessions. Try again later.' },
        { status: 503, headers },
      );
    const token = randomBytes(32).toString('hex');
    this.sessions.set(token, now + sessionSeconds * 1000);
    headers.set('Set-Cookie', this.cookie(token, sessionSeconds));
    return Response.json({ username: this.config.values.DEMO_USERNAME }, { headers });
  }
}
