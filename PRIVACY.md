# Privacy

Ginmap v1 summarizes public GitHub activity. It is intentionally designed not to request private-repository or repository-write OAuth scopes. The OAuth callback rejects an authorization if GitHub returns any non-empty OAuth scope.

## Data Ginmap reads

When you connect GitHub, Ginmap reads public GitHub information needed to build your work summary, including your public profile, public pull requests and issues, public contribution aggregates, and public repository metadata.

Ginmap does not request access to private repository names, private code, private pull requests, or private issues. It does not attempt to identify repositories behind GitHub's restricted/private contribution counts.

## Data Ginmap stores

A hosted instance may store:

- your GitHub numeric ID, login, avatar URL, and account creation date;
- normalized records for public pull requests and issues;
- public contribution aggregates and repository metadata;
- profile display settings;
- cached public profile snapshots;
- an OAuth access token so background synchronization can continue.

OAuth access tokens and refresh tokens (when GitHub issues them) are encrypted before database storage. Session cookies are HTTP-only. Operators must treat the database and its backups as sensitive because encrypted tokens are still credentials.

## Public output

If your Ginmap profile is enabled, the HTML profile, SVG card, and public JSON API expose only the public summary and repositories you have not hidden in Ginmap. Hidden repositories remain stored until you delete your Ginmap data or the source becomes unavailable, but they are excluded from public output.

## Repository visibility changes

Ginmap periodically reconciles repository metadata. If a repository previously visible to Ginmap is no longer accessible through the public-data OAuth token, Ginmap removes that repository's records from the user's public activity model. Repository renames are tracked by GitHub numeric ID.

## Disconnect and deletion

Disconnecting GitHub removes the stored OAuth token and stops future synchronization while leaving the existing Ginmap profile data in place.

Deleting Ginmap data removes the user record and its associated OAuth token, settings, normalized activity, snapshots, and sync history through database cascade deletion.

Self-hosted operators control their own backups and retention policies; deletion from the live database cannot by itself erase copies retained in backups.

## Network access

The hosted web application and background worker communicate with GitHub's APIs. Public README images may be fetched and cached by GitHub's image proxy. Ginmap does not require analytics or advertising services to function.
