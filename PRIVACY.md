# Privacy

Ginmap summarizes public GitHub activity. Public information becomes easier to discover when it is aggregated, so Ginmap treats indexing, retention, and owner control as part of the privacy model.

## Public profiles

Anyone can ask Ginmap to summarize a public GitHub account. No GitHub authorization from that person is required because the source material is public.

An **unclaimed** Ginmap is `noindex` by default. It can be viewed by URL but should not automatically become part of a search-engine-indexed directory. Unclaimed profiles may be deleted after a period of inactivity and rebuilt on demand later.

A verified owner can claim a profile and explicitly choose whether search engines may index it.

## Data Ginmap reads

Ginmap reads public GitHub information needed to build the work summary, including:

- public account identity;
- authored public pull requests and issues;
- GitHub-reported public contribution aggregates;
- public repository metadata.

Ginmap does not request private-repository or repository-write OAuth scopes. It does not attempt to identify repositories behind restricted/private contribution counts.

## Data Ginmap stores

A hosted instance may store:

- GitHub numeric ID, login, avatar URL, and account creation date;
- normalized public pull-request and issue records;
- public contribution aggregates and repository metadata;
- cached profile snapshots and sync state;
- owner presentation settings after a profile is claimed;
- an encrypted no-scope OAuth credential for a claimed owner so ownership and background synchronization can continue.

OAuth access and refresh tokens are encrypted before database storage. Session cookies are HTTP-only. Operators must still treat the database and backups as sensitive.

## Public output

HTML, SVG, and JSON expose the same public work model. If the owner hides a repository, that repository is excluded from all public Ginmap surfaces. Owner customization changes presentation and does not rewrite GitHub facts.

## Repository visibility changes

Ginmap periodically reconciles repository metadata. If a previously public repository becomes unavailable to Ginmap's public-data credentials, Ginmap removes that repository's records from the public work model. Renames are tracked by durable GitHub numeric ID.

## Claim, disconnect, and deletion

Claiming verifies ownership through GitHub OAuth with no requested scopes.

Disconnecting the claim removes the stored OAuth credential. The public Ginmap can continue as an unclaimed public-data profile and becomes subject to unclaimed indexing and retention rules.

Deleting Ginmap data removes the user record and associated credentials, settings, normalized activity, snapshots, and sync history through database cascade deletion. A later public request can build a new unclaimed snapshot from GitHub's public data.

Self-hosted operators control their own backups and retention policies; deleting the live database record does not erase copies retained in backups.

## Network access

The hosted web application and worker communicate with GitHub's APIs. GitHub may proxy and cache README images through Camo. Ginmap does not require advertising or analytics services to function.
