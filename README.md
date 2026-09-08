# Ginmap

**The missing summary layer for GitHub profiles.**

Ginmap turns public GitHub history into a readable, evidence-backed map of what someone has actually done: the projects they built, the repositories they contributed to, and the pull requests and issues behind those claims.

## Use Ginmap

Open a GitHub username on the hosted service:

```text
https://ginmap.ginbing.com/octocat
```

No sign-up, token, GitHub Action, or self-hosting is required.

### GitHub Profile README

Paste one stable link:

```md
[![Ginmap](https://ginmap.ginbing.com/octocat.svg)](
  https://ginmap.ginbing.com/octocat
)
```

### Machine-readable summary

```text
https://ginmap.ginbing.com/octocat.json
```

HTML, SVG, and JSON come from the same normalized work model.

## What Ginmap shows

- lifetime authored and merged pull requests;
- authored issues and GitHub-reported review/contribution totals;
- **Projects**: repositories the person owns;
- **External contributions**: work in repositories owned by others;
- repository-level evidence with links back to GitHub;
- yearly activity summaries;
- additions, deletions, and changed files through authored PRs, clearly labeled as diff totals.

Ginmap does not create developer scores, infer employment or maintainership, or require repository write/private-repository access.

## Claim your profile

Anyone can read a public Ginmap without authentication. The owner can optionally claim it with a no-scope GitHub OAuth authorization to:

- hide irrelevant repositories;
- pin and reorder representative work;
- choose card metrics;
- control public visibility and search indexing;
- refresh or delete their Ginmap data.

Claiming changes presentation, never GitHub facts.

## How it works

Ginbing operates the hosted service. Ginmap collects public GitHub data asynchronously, normalizes lifetime work into PostgreSQL, and serves last-good snapshots to the public surfaces. Page and README views do not reconstruct a GitHub lifetime synchronously.

Unclaimed profiles are `noindex` by default and may expire after inactivity. Claimed owners can explicitly enable search indexing.

See [Architecture](docs/ARCHITECTURE.md), [Metrics](docs/METRICS.md), [Privacy](PRIVACY.md), and [Security](SECURITY.md).

## Self-hosting

Self-hosting is optional. Operators who want to run their own instance can use Docker and PostgreSQL; see [Self-hosting](docs/SELF-HOSTING.md).

## License

Ginmap is licensed under **GNU Affero General Public License v3.0 only**. See [LICENSE](LICENSE).
