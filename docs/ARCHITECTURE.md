# Architecture

Ginmap has three runtime components:

```text
GitHub Camo / browser
        |
    Next.js web
        |
    PostgreSQL
        |
   sync worker
        |
    GitHub API
```

The web process handles OAuth, the dashboard, public profiles, JSON endpoints, and SVG rendering. The worker owns GitHub backfill and reconciliation. PostgreSQL is the durable boundary between them.

## Data flow

1. A user signs in through a GitHub OAuth App that requests no scopes.
2. Ginmap stores the OAuth credential encrypted with AES-256-GCM and queues a `backfill` job. Both GitHub long-lived OAuth tokens and optional expiring access/refresh-token pairs are supported.
3. The worker reads contribution years from GraphQL.
4. It processes years oldest to newest. After each year it persists a checkpoint, so a failed lifetime crawl resumes from that year rather than starting over.
5. Authored PRs and issues are found through GitHub Search. Search windows that exceed GitHub's 1,000-result retrieval limit are split recursively by time until every partition is exhaustible.
6. GitHub-counted commit/review contributions and exact PR/issue records are normalized in PostgreSQL.
7. Ginmap builds a profile snapshot from that normalized state.
8. Public HTML, JSON, and SVG surfaces read the snapshot. They do not call GitHub.

## Sync strategy

`backfill` builds the lifetime model. `incremental` refreshes items updated since the previous successful sync with a small overlap and re-reads the current contribution year. `reconcile` re-reads the current and previous years plus all open authored PRs, then revalidates every repository represented in the stored work map. Renames update metadata by GitHub numeric ID; repositories no longer visible to the public-data token are removed from that user's public activity model. When visibility removal occurs, Ginmap also re-reads contribution aggregates across the account's contribution years so stale once-public commit/review totals are not kept in the public snapshot.

Jobs are PostgreSQL-backed and claimed with `FOR UPDATE SKIP LOCKED`. Failed jobs retry with bounded exponential backoff. A snapshot remains usable even when GitHub is unavailable.

## Identity

GitHub numeric IDs are the durable identity for users and repositories. Logins and repository names are presentation fields. Previous GitHub logins are retained as aliases so old public Ginmap URLs can redirect to the current login.

## Security boundary

Ginmap v1 does not request private-repository or repository-write OAuth scopes. Public endpoints never expose OAuth state, tokens, internal database IDs, or repositories the user has hidden in Ginmap.
