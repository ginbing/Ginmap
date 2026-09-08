# Metric definitions

Ginmap favors stable, explainable facts over reputation scores.

## Authored pull requests

The number of public pull requests returned by GitHub Search for `author:<login>`. Lifetime search is partitioned by creation time when a query would exceed GitHub's 1,000-result retrieval limit.

### Merged pull requests

Authored public pull requests whose GitHub `merged` field is true.

### Open pull requests

Authored public pull requests whose current GitHub state is open.

### Closed, unmerged pull requests

Authored public pull requests that are not merged and are no longer open.

## Authored issues

The number of public issues returned by GitHub Search for `is:issue author:<login>`. Pull requests are excluded.

## Reviews

GitHub-counted pull-request review contributions grouped by public repository through `contributionsCollection`. GitHub limits repository-group contribution fields to a maximum repository count; Ginmap currently requests the maximum of 100 repositories per contribution year. For unusually broad yearly activity this can undercount review/commit repository groups. Exact authored PR and issue totals do not use this bounded grouping.

## GitHub-counted commits

The lifetime and yearly commit totals use GitHub's `totalCommitContributions`, which GitHub defines as the number of commits made by the user in the selected contribution time span. Because Ginmap requests no `read:user` scope, GitHub excludes private and internal repository contributions from this collection.

At repository level, GitHub's grouped commit contribution connection represents **days with qualifying commits**, not raw commits. Ginmap therefore labels that repository-level value `commit days` and does not misrepresent it as a commit count.

## Public contributions

The GitHub contribution-calendar total with `restrictedContributionsCount` removed. Private repository identities are never ingested. Ginmap does not try to reverse-engineer private activity.

## Repositories worked in

A public repository where Ginmap can verify at least one authored PR, authored issue, GitHub-counted commit contribution, or GitHub-counted review contribution for the user. Authored PR and issue repository discovery is exhaustive through partitioned Search. GitHub limits the commit/review repository groupings to 100 repositories per contribution year, so an unusually broad account can have additional commit-only or review-only repositories that are not represented in this count.

## Code changed through authored PRs

The sum of GitHub's `additions`, `deletions`, and `changedFiles` fields across authored public pull requests.

This is deliberately **not** called “lines of code written.” PR diffs can contain generated code, lockfiles, formatting changes, vendored files, and deletions. Ginmap reports the underlying diff totals without turning them into a productivity score.

## Repository role

`owner` means the current repository owner login matches the user's current GitHub login. All other repositories are labeled `contributor`.

Ginmap does not infer maintainer status, employment, project importance, or developer quality from activity.
