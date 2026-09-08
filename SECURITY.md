# Security

Please do not open public issues for vulnerabilities that could expose OAuth tokens, session secrets, or user data. Report security issues privately through this repository's GitHub security advisory flow.

Ginmap is designed around public GitHub data. The hosted service does not request private-repository or repository-write access.

## GitHub credentials

Owner claim uses a GitHub OAuth authorization with no requested scopes. The callback rejects any non-empty returned scope.

Anonymous ingestion uses a server-owned `GITHUB_PUBLIC_TOKEN`. Ginmap verifies at runtime that GitHub reports an empty `X-OAuth-Scopes` value for this token. Operators should create it from a dedicated service account that is not a collaborator on private repositories or private organizations. Do not replace it with a broadly scoped PAT.

GitHub API calls are serialized and rate-limit responses honor `Retry-After` and `X-RateLimit-Reset` before retrying.

## Sessions and state changes

Session cookies are HTTP-only, same-site, and signed. Sessions include a server-side version so disconnecting GitHub invalidates previously issued sessions.

State-changing form endpoints require a same-origin `Origin` and reject cross-site requests. Deploy the web service behind a controlled reverse proxy and configure `NEXT_PUBLIC_APP_URL` to the public origin.

## Anonymous profile generation

Uncached profile generation is bounded by global and per-requester admission limits, negative lookup caching, and a database guarantee that only one pending/running sync job exists for a profile. The global limit still applies if proxy-provided client IP headers are unavailable or untrusted.

## Stored credentials

OAuth access and refresh tokens are encrypted with AES-256-GCM before database storage. Treat the database, backups, `TOKEN_ENCRYPTION_KEY`, `SESSION_SECRET`, OAuth client secret, and public service token as production secrets.
