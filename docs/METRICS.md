# Metric definitions

Ginmap reports explainable GitHub facts. It does not create reputation or productivity scores.

## Authored pull requests

The number of public pull requests returned by GitHub Search for `author:<login>`. Lifetime search is partitioned by time when a query would exceed GitHub's 1,000-result retrieval limit.

### Merged pull requests

Authored public pull requests whose GitHub `merged` field is true.

### Open pull requests

Authored public pull requests whose current GitHub state is open.

### Closed, unmerged pull requests

Authored public pull requests that are not merged and are no longer open.

## Authored issues

The number of public issues returned by GitHub Search for `is:issue author:<login>`. Pull requests are excluded.

## Reviewed pull requests

Ginmap uses GitHub's pull-request review contribution model. This is a contribution count for reviewed pull requests, not a count of every raw review submission. Repository groupings come from `contributionsCollection` and are limited by GitHub to 100 repositories per contribution year, so unusually broad review-only activity can be incomplete at repository level.

## GitHub-counted commits

Lifetime and yearly totals use GitHub's `totalCommitContributions`. Repository-level values use the `totalCount` returned by the repository's commit-contribution connection. Ginmap labels these values **commits**, not commit days.

GitHub decides which commits qualify as profile contributions. Ginmap preserves that definition instead of reconstructing commits from repository history.

## Public contributions

The GitHub contribution-calendar total with `restrictedContributionsCount` removed. Ginmap does not identify repositories behind restricted/private contribution counts.

## Repositories worked in

A public repository where Ginmap can verify at least one authored PR, authored issue, GitHub-counted commit contribution, or GitHub-counted review contribution. Authored PR and issue repository discovery is exhaustive through partitioned Search. Commit/review repository groupings are limited to 100 repositories per contribution year by GitHub.

## Hidden repositories

When an owner hides a repository, Ginmap removes that repository from HTML, SVG, and JSON and recomputes metrics that can be derived exactly from visible repository records: PR totals and states, issues, repositories worked in, additions, deletions, and changed files.

GitHub does not expose all account-wide contribution, commit, and review totals in a form that Ginmap can reliably subtract repository by repository. When any repository is hidden, Ginmap therefore withholds those account-wide metrics and yearly account-wide history instead of publishing numbers that still include hidden work.

## Code changed through authored PRs

The sum of GitHub's `additions`, `deletions`, and `changedFiles` fields across authored public pull requests that are visible in the Ginmap profile.

This is deliberately not called "lines of code written." PR diffs can contain generated code, lockfiles, formatting changes, vendored files, and deletions.

## Projects and external contributions

A **Project** is a measurable repository relationship where the repository is currently owned by the GitHub user and the repository is not a fork. Personal forks are not presented as things the person built.

An **External contribution** is measurable work in a repository currently owned by another GitHub account or organization.

These labels do not imply employment, maintainership, project membership, or developer quality.

## Activity dates

Exact first/last activity dates are reported only when Ginmap has exact PR or issue timestamps. Commit/review-only repository activity is represented with year precision rather than invented January 1 / December 31 dates.
