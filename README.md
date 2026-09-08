# Ginmap

**Your GitHub work, mapped.**

Ginmap turns public GitHub history into one live work map: what you built, where you contributed, and the pull requests and issues behind those claims.

Use the same Ginmap as a personal developer page, embed it on your own website, or put a compact card in your GitHub Profile README. Ginmap keeps the data behind every surface up to date automatically.

## Hosted personal page

Open any public GitHub username:

```text
https://ginmap.ginbing.com/octocat
```

The page is a complete single-page developer presence generated from GitHub. There is no blog, CMS, résumé editor, or manually maintained project list.

No sign-up is required to read a public Ginmap.

## Website embed

Load the framework-independent Web Component once, then place a Ginmap anywhere in the page:

```html
<script type="module" src="https://ginmap.ginbing.com/widget.js"></script>
<gin-map username="octocat" view="full" theme="auto"></gin-map>
```

Supported attributes:

- `username` — required GitHub login;
- `view="full|compact"` — full work map or smaller website section;
- `theme="auto|light|dark"` — rendering theme.

The component uses Shadow DOM so Ginmap styles do not leak into the host website and host styles do not rewrite Ginmap.

For sites that cannot run the module, use the iframe fallback:

```html
<iframe
  src="https://ginmap.ginbing.com/octocat/embed"
  title="octocat's GitHub work map"
  loading="lazy">
</iframe>
```

## GitHub Profile README

Paste one stable URL:

```md
[![Ginmap](https://ginmap.ginbing.com/octocat.svg)](
  https://ginmap.ginbing.com/octocat
)
```

The SVG is dynamic. Ginmap refreshes the stored work snapshot in the background, so the README does not need generated-file commits or a scheduled GitHub Action.

## Public data contract

Portable renderers use the same versioned work-map response:

```text
https://ginmap.ginbing.com/api/v1/users/octocat/summary
```

The convenience alias remains available:

```text
https://ginmap.ginbing.com/octocat.json
```

The JSON API is the contract behind the product surfaces, not a separate profile product.

## What Ginmap shows

- lifetime authored and merged pull requests;
- authored issues and GitHub-reported contribution data where reliable;
- **Projects** — owned, non-fork repositories with measurable work;
- **External contributions** — work in repositories owned by others;
- repository descriptions, languages, PR/issue titles, and direct links back to GitHub evidence;
- yearly activity summaries where account-wide metrics are safe to publish;
- additions, deletions, and changed files through authored PRs, labeled as diff totals.

Ginmap does not create developer scores, infer employment or maintainership, or require repository write/private-repository access.

## Live updates

GitHub remains the source of truth. Ginmap collects public GitHub data asynchronously, normalizes it into PostgreSQL, and serves a last-good snapshot to every public surface.

Page, Web Component, iframe, SVG, and JSON requests do not reconstruct a lifetime history on every view. Active profiles refresh incrementally, mutable PR state is reconciled, and the previous snapshot remains available during GitHub outages.

## Claim your Ginmap

The owner can optionally claim a Ginmap with a no-scope GitHub OAuth authorization. Claiming exists only to prove ownership and save presentation choices.

Owners can:

- hide irrelevant repositories;
- pin and reorder representative work;
- choose README card metrics;
- control public visibility and search indexing;
- trigger a refresh;
- delete their Ginmap data.

Presentation choices affect every public surface without changing GitHub facts. Ginmap never requires a user PAT, repository write access, private-repository access, or a GitHub Action.

Verified custom domains are part of the product scope. Application support will ship only with a deployment path that can prove domain ownership, hostname routing, and TLS certificate lifecycle end to end.

## Architecture

The same normalized model powers every surface:

```text
GitHub APIs
    ↓
ingestion and reconciliation
    ↓
PostgreSQL
    ↓
last-good work-map snapshot
   ↙       ↓       ↓       ↘
page   Web Component  iframe   SVG
              ↓
        public JSON contract
```

See [Architecture](docs/ARCHITECTURE.md), [Metrics](docs/METRICS.md), [Privacy](PRIVACY.md), and [Security](SECURITY.md).

## Self-hosting

Self-hosting is optional. Operators can run Ginmap with Docker and PostgreSQL; see [Self-hosting](docs/SELF-HOSTING.md).

## License

Ginmap is licensed under **GNU Affero General Public License v3.0 only**. See [LICENSE](LICENSE).
