# Authentication

Last synced: 2026-03-28 | Commit: 97ab426 (development branch)

Magically supports three authentication methods: JWT bearer tokens, API keys (prefixed `mg_`), and query-string tokens. Authentication is enforced globally via a NestJS guard with opt-out via the `@Public()` decorator.

---

## Authentication Methods

| Method | Header / Location | Format | Use Case |
|---|---|---|---|
| JWT Bearer | `Authorization: Bearer <token>` | Signed JWT (HS256, 7d expiry) | Web app, CLI after login |
| API Key | `X-API-Key: mg_...` | `mg_` + 24 random bytes (base64url) | Programmatic access, CI/CD |
| Query Token | `?token=<jwt>` | Same JWT as Bearer | Iframes, WebSocket handshake fallback |

The `AuthGuard` tries them in order: JWT verification first, then API key lookup (if token starts with `mg_`), then fails.

---

## JWT Structure

### Payload (`JwtPayload`)

```typescript
interface JwtPayload {
  sub: string;    // user UUID
  email: string;  // user email
  name?: string;  // user display name (optional)
}
```

### Signing

| Parameter | Value |
|---|---|
| Algorithm | HS256 (default `jsonwebtoken` behavior) |
| Secret | `JWT_SECRET` env var (required, `getOrThrow`) |
| Expiration | `7d` |
| Library | `jsonwebtoken` |

### Token Generation

`buildAuthResult()` in `AuthService` signs the JWT. It is called by:

- `signup()` -- after inserting the user
- `login()` -- after bcrypt password verification
- `findOrCreateGoogleUser()` -- after Google OAuth user lookup/creation

### Token Verification

`verifyToken(token)` calls `jwt.verify(token, jwtSecret)` and casts to `JwtPayload`. Throws on expired or invalid tokens.

---

## API Key Format

### Generation

```
rawKey = "mg_" + randomBytes(24).toString('base64url')
keyHash = SHA256(rawKey).hex()
keyPrefix = rawKey.substring(0, 8)    // "mg_" + first 5 chars of random part
```

### Storage

The `api_keys` table stores:

| Column | Value |
|---|---|
| `id` | UUID |
| `userId` | FK to users |
| `keyHash` | SHA256 hex of the full raw key |
| `keyPrefix` | First 8 chars (for display: `mg_xxxxx`) |
| `name` | User-provided label |
| `createdAt` | Timestamp |
| `lastUsedAt` | Updated on each successful validation |

The raw key is returned exactly once at creation time and never stored.

### Validation

`validateApiKey(rawKey)`:

1. SHA256 hash the raw key.
2. Look up `keyHash` in `api_keys` table.
3. If found, update `lastUsedAt`.
4. Look up the associated user from `users` table.
5. Return `{ id, email, name }` or `null`.

---

## AuthGuard Implementation

File: `packages/runtime/src/auth/auth.guard.ts`

### Guard Logic

The `AuthGuard` is a global NestJS guard (`CanActivate`). It runs on every HTTP request.

```
1. Check @Public() metadata via Reflector
   -> If isPublic === true, return true (skip auth)

2. Extract token from request (see Token Extraction Order below)
   -> If no token found, throw UnauthorizedException('Missing authentication')

3. Try JWT verification (auth.verifyToken)
   -> If valid, set request.user = JwtPayload, return true

4. If JWT failed AND token starts with 'mg_':
   -> Try auth.validateApiKey(token)
   -> If valid, set request.user = { sub: user.id, email, name }, return true

5. Throw UnauthorizedException('Invalid authentication')
```

### Token Extraction Order

`extractToken(request)` checks three sources in order:

| Priority | Source | Check |
|---|---|---|
| 1 | `Authorization` header | Starts with `Bearer `, extract substring after index 7 |
| 2 | `X-API-Key` header | `typeof apiKey === 'string'` |
| 3 | `?token` query param | `typeof queryToken === 'string'` |

First non-null value wins. If all three are absent, returns `null`.

### @Public() Decorator

```typescript
const IS_PUBLIC = 'isPublic';
const Public = () => SetMetadata(IS_PUBLIC, true);
```

Applied to controller methods or classes to exempt them from authentication. The guard checks this metadata via `Reflector.getAllAndOverride()` which merges handler-level and class-level metadata.

### Public Endpoints

| Endpoint | Controller Method |
|---|---|
| `POST /api/auth/signup` | `AuthController.signup()` |
| `POST /api/auth/login` | `AuthController.login()` |
| `GET /api/auth/google` | `AuthController.googleRedirect()` |
| `GET /api/auth/google/callback` | `AuthController.googleCallback()` |

All other endpoints require authentication.

---

## Express Request Augmentation

File: `packages/runtime/src/auth/authenticated-request.d.ts`

```typescript
declare module 'express' {
  interface Request {
    user?: {
      sub: string;
      email: string;
      name?: string | null;
    };
  }
}
```

This module augmentation adds the `user` property to Express `Request`. After the AuthGuard sets `request.user`, controllers can access it directly as `req.user` without casting to `any`. The `user` property is optional because `@Public()` routes may not have it set.

---

## Google OAuth Flow

### Step-by-Step

```
1. Client navigates to GET /api/auth/google
   - Optional: ?cli_redirect=<url> for CLI login flow

2. Server builds Google OAuth URL:
   - client_id: GOOGLE_CLIENT_ID env
   - redirect_uri: {RUNTIME_URL}/api/auth/google/callback
   - scope: "openid email profile"
   - access_type: offline
   - prompt: consent
   - state: base64url(JSON({ cli_redirect }))  [if cli_redirect provided]

3. Server redirects (302) to Google OAuth consent screen

4. User consents on Google

5. Google redirects to GET /api/auth/google/callback?code=<code>&state=<state>

6. Server exchanges code for tokens:
   POST https://oauth2.googleapis.com/token
   { code, client_id, client_secret, redirect_uri, grant_type: 'authorization_code' }

7. Server fetches user profile:
   GET https://www.googleapis.com/oauth2/v2/userinfo
   Authorization: Bearer <access_token>

8. Server calls findOrCreateGoogleUser(profile):
   a. SELECT user by email
   b. If exists:
      - If provider !== 'google', UPDATE to set provider='google', providerId, avatarUrl
      - Return buildAuthResult(user)
   c. If not exists:
      - INSERT new user with provider='google'
      - Return buildAuthResult(user)

9. Server redirects to:
   {WEB_URL}/auth/callback?token=<jwt>[&cli_redirect=<url>]
   - WEB_URL defaults to http://localhost:5173
```

### CLI Login Flow

The CLI can initiate Google OAuth by passing `?cli_redirect=<url>` to the `/api/auth/google` endpoint. This URL survives the OAuth round-trip via Google's `state` parameter (base64url-encoded JSON). After authentication, the web callback page receives both the JWT token and the `cli_redirect` URL, allowing it to relay the token back to the CLI's local HTTP server.

### Environment Variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `GOOGLE_CLIENT_ID` | Yes | (none, `getOrThrow`) | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | (none, `getOrThrow`) | Google OAuth client secret |
| `RUNTIME_URL` | No | `http://localhost:4321` | Base URL for callback redirect |
| `WEB_URL` | No | `http://localhost:5173` | Web app URL for final redirect |
| `JWT_SECRET` | Yes | (none, `getOrThrow`) | JWT signing secret |

---

## Auth Controller Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/signup` | Public | Create account with email/password. Body: `{ email, password, name? }`. Returns `AuthResult`. |
| `POST` | `/api/auth/login` | Public | Login with email/password. Body: `{ email, password }`. Returns `AuthResult`. HTTP 200 (not 201). |
| `GET` | `/api/auth/google` | Public | Redirect to Google OAuth consent. Query: `?cli_redirect=<url>` (optional). |
| `GET` | `/api/auth/google/callback` | Public | Google OAuth callback. Exchanges code, creates/finds user, redirects to web with JWT. |
| `POST` | `/api/auth/api-keys` | Authenticated | Create an API key. Body: `{ name }`. Returns `{ rawKey, apiKey: { id, name, keyPrefix } }`. |
| `GET` | `/api/auth/me` | Authenticated | Returns `request.user` (the JwtPayload set by AuthGuard). |

### AuthResult Shape

```typescript
interface AuthResult {
  user: { id: string; email: string; name: string | null; provider: string };
  accessToken: string;
}
```

---

## Frontend Auth Store (`apps/web/src/lib/auth.ts`)

### Zustand Store: `useAuthStore`

```typescript
interface AuthState {
  token: string | null;
  user: AuthUser | null;
  isRestoring: boolean;       // true while validating stored token on startup

  isAuthenticated: () => boolean;
  setAuth: (token: string, user: AuthUser) => void;
  logout: () => void;
  setRestoring: (value: boolean) => void;
}

interface AuthUser {
  id: string;
  email: string;
  name: string | null;
}
```

### localStorage Persistence

| Key | Value |
|---|---|
| `magically_token` | JWT string |
| `magically_user` | JSON-serialized `AuthUser` |

Both keys are read synchronously at module load time so the first render has the token available without a flash of unauthenticated state.

### `setAuth(token, user)`

1. `localStorage.setItem('magically_token', token)`
2. `localStorage.setItem('magically_user', JSON.stringify(user))`
3. Sets state: `{ token, user, isRestoring: false }`

Catches and ignores storage errors (quota exceeded, private browsing).

### `logout()`

1. Calls `disconnectSocket()` (global socket cleanup).
2. `localStorage.removeItem('magically_token')`
3. `localStorage.removeItem('magically_user')`
4. Sets state: `{ token: null, user: null, isRestoring: false }`

### `isRestoring` Flag

If a stored token exists at module load time, `isRestoring` starts as `true`. The app is expected to validate the token against `GET /api/auth/me` on startup and then call `setRestoring(false)`. This prevents the app from flashing a login screen while the token is being validated.

---

## Module Exports (`packages/runtime/src/auth/index.ts`)

```typescript
export { AuthModule } from './auth.module';
export { AuthService, type JwtPayload, type AuthResult } from './auth.service';
export { AuthGuard, Public, IS_PUBLIC } from './auth.guard';
```

---

## Known Issues

| Issue | Description |
|---|---|
| No token refresh | JWTs expire after 7 days with no refresh token mechanism. The user must re-login. |
| No email verification | `signup()` does not verify the email address. Any string is accepted. |
| Google overwrites provider | If a user signs up with email/password and later uses Google OAuth with the same email, the `provider` field is overwritten to `google` and `providerId` / `avatarUrl` are set. The password hash remains but the provider field no longer says `local`. |
| Password not required for Google users | Google-created users have no `passwordHash`. The `login()` method rejects them with "Invalid email or password" since `!user.passwordHash` is true. There is no error message indicating they should use Google login. |
| API key cannot be revoked | There is no `DELETE /api/auth/api-keys/:id` endpoint. Keys can only be created. |
| API key cannot be listed | There is no `GET /api/auth/api-keys` endpoint to list existing keys for a user. |
| WebSocket auth is JWT-only | The `ZeusGateway` calls `verifyToken()` which only handles JWTs. API keys cannot be used to authenticate WebSocket connections. |
| Hardcoded bcrypt rounds | Password hashing uses a fixed 10 rounds. Not configurable via env var. |
| No rate limiting on auth endpoints | `signup`, `login`, and Google OAuth endpoints have no rate limiting. |
