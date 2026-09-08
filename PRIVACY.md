# Privacy

Ginmap summarizes public GitHub activity. Aggregation makes public information easier to discover, so indexing, retention, hiding, and owner control are part of the privacy model.

## Public profiles

Anyone can ask Ginmap to summarize a public GitHub account. No authorization from that person is required for the initial public-data view.

An **unclaimed** Ginmap is `noindex` by default and may expire after inactivity. A verified owner can claim the profile, decide whether it is publicly visible, and separately decide whether search engines may index it.

## Data Ginmap reads

Ginmap reads public GitHub information needed to build the work summary, including public account identity, authored public pull requests and issues, GitHub-reported public contribution aggregates, and public repository metadata.

Ginmap does not request private-repository or repository-write OAuth scopes. It does not attempt to identify repositories behind restricted/private contribution counts.

## Data Ginmap stores

A hosted instance may store public GitHub identity, normalized public PR/issue records, public contribution aggregates, repository metadata, cached snapshots, sync state, owner presentation settings, and an encrypted no-scope OAuth credential while the owner keeps GitHub connected.

OAuth access and refresh tokens are encrypted before database storage. Session cookies are HTTP-only. Operators must still treat the database and backups as sensitive.

## Hidden repositories

If an owner hides a repository, Ginmap removes that repository from HTML, SVG, JSON, and repository detail pages.

Metrics that can be recomputed exactly are recalculated from the remaining visible repositories. Account-wide contribution, commit, review, and yearly totals are withheld while repositories are hidden when GitHub does not expose enough information to subtract the hidden repository safely.

## Claim, disconnect, and deletion

Claiming records a persistent ownership verification. Disconnecting GitHub removes the stored OAuth credential and revokes existing Ginmap sessions, but it does **not** erase the owner's visibility or indexing choices and does not turn the profile back into an unclaimed profile.

Deleting Ginmap data removes the live profile, credentials, settings, normalized activity, snapshots, and sync history. Ginmap keeps a minimal opt-out tombstone containing the GitHub numeric ID and last known login so another anonymous request cannot immediately rebuild the deleted profile. The owner can later reclaim the profile through GitHub OAuth, which removes that opt-out.

Self-hosted operators control their own backups and retention policies; deletion from the live database does not erase copies retained in backups.

## Repository and username changes

Ginmap tracks GitHub users and repositories by durable numeric IDs. The worker resolves a public user by numeric account ID during synchronization so username changes do not depend on the old login continuing to resolve. Repository visibility is reconciled periodically; data for a repository that is no longer public to Ginmap's public credential is removed from that profile's public model.

## Network access

The hosted web application and worker communicate with GitHub's APIs. GitHub may proxy and cache README images through Camo. Ginmap does not require advertising or analytics services to function.
