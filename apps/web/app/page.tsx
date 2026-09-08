import Link from "next/link";

export default function HomePage() {
  return (
    <>
      <section className="hero">
        <div className="shell hero-grid">
          <div>
            <div className="eyebrow">GitHub, summarized</div>
            <h1>Show what you&apos;ve actually done on GitHub.</h1>
            <p className="lede">Ginmap turns years of pull requests, issues, reviews, commits, and repository activity into a profile another person can understand in seconds.</p>
            <div className="actions">
              <a className="button primary" href="/api/auth/github/start">Connect GitHub</a>
              <a className="button" href="https://github.com/ginbing/Ginmap">View source</a>
            </div>
            <p className="muted">Public data only. No private repositories. No repository write access. No PAT.</p>
          </div>
          <div className="demo-card" aria-label="Example Ginmap work summary">
            <header><div><h2>octocat</h2><small>GitHub work · lifetime public summary</small></div><strong>Ginmap</strong></header>
            <div className="metric-grid">
              <div className="metric"><strong>203</strong><span>PRs</span></div>
              <div className="metric"><strong>161</strong><span>merged</span></div>
              <div className="metric"><strong>272</strong><span>issues</span></div>
              <div className="metric"><strong>42</strong><span>reviews</span></div>
              <div className="metric"><strong>18</strong><span>repos</span></div>
            </div>
            <div className="eyebrow">Worked in</div>
            <div className="repo-line"><span>org/application</span><span>12 PRs · 9 merged</span></div>
            <div className="repo-line"><span>org/infrastructure</span><span>7 PRs · 6 merged</span></div>
            <div className="repo-line"><span>user/tooling</span><span>5 PRs · 4 merged</span></div>
          </div>
        </div>
      </section>
      <section className="section"><div className="shell"><h2>The missing summary layer for GitHub profiles.</h2><p className="section-intro">GitHub keeps the evidence. Ginmap makes the evidence legible: lifetime totals, repository relationships, and a durable public record that updates without rewriting your README.</p><div className="feature-grid">
        <div className="feature"><h3>Lifetime, not one green year</h3><p>Backfill the public history GitHub spreads across years and turn it into stable, documented metrics.</p></div>
        <div className="feature"><h3>Repositories are the map</h3><p>See where work happened, how many PRs were merged, and which projects actually accepted contributions.</p></div>
        <div className="feature"><h3>Paste once</h3><p>Embed one live SVG card. Manage what it shows on Ginmap instead of committing README edits forever.</p></div>
      </div></div></section>
      <section className="section"><div className="shell"><div className="panel"><h2>Built for people and agents</h2><p className="section-intro">The same normalized work model powers the public profile, README SVG, and versioned JSON API. A recruiter, maintainer, or AI agent does not need to reconstruct your GitHub history from thousands of timeline entries.</p><div className="actions"><Link className="button primary" href="/api/auth/github/start">Build my Ginmap</Link><a className="button" href="https://github.com/ginbing/Ginmap/blob/main/docs/METRICS.md">Read metric definitions</a></div></div></div></section>
    </>
  );
}
