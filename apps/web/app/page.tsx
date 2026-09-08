export default function HomePage() {
  return (
    <>
      <section className="hero">
        <div className="shell hero-grid">
          <div>
            <div className="eyebrow">GitHub, summarized</div>
            <h1>Show what you&apos;ve actually done on GitHub.</h1>
            <p className="lede">Ginmap turns public GitHub history into a readable map of the projects someone built and the repositories they contributed to.</p>
            <form className="lookup" action="/api/lookup" method="get">
              <label htmlFor="username">GitHub username</label>
              <div className="lookup-row">
                <input id="username" name="username" placeholder="octocat" autoComplete="off" required />
                <button className="button primary" type="submit">View Ginmap</button>
              </div>
            </form>
            <p className="muted">No sign-up, token, GitHub Action, or self-hosting required.</p>
          </div>
          <div className="demo-card" aria-label="Example Ginmap work summary">
            <header><div><h2>octocat</h2><small>Lifetime public GitHub work</small></div><strong>Ginmap</strong></header>
            <div className="metric-grid">
              <div className="metric"><strong>203</strong><span>PRs</span></div>
              <div className="metric"><strong>161</strong><span>merged</span></div>
              <div className="metric"><strong>272</strong><span>issues</span></div>
              <div className="metric"><strong>42</strong><span>reviews</span></div>
              <div className="metric"><strong>34</strong><span>repos</span></div>
            </div>
            <div className="eyebrow">External contributions</div>
            <div className="repo-line"><span>org/application</span><span>12 PRs · 9 merged</span></div>
            <div className="repo-line"><span>org/infrastructure</span><span>7 PRs · 6 merged</span></div>
            <div className="repo-line"><span>user/tooling</span><span>5 PRs · 4 merged</span></div>
          </div>
        </div>
      </section>
      <section className="section"><div className="shell"><h2>The missing summary layer for GitHub profiles.</h2><p className="section-intro">GitHub keeps the evidence. Ginmap organizes it around the questions people actually ask: what did this person build, where did they contribute, and what GitHub evidence supports it?</p><div className="feature-grid">
        <div className="feature"><h3>Projects</h3><p>Separate repositories someone owns from the rest of their activity, so original work is easy to find.</p></div>
        <div className="feature"><h3>External contributions</h3><p>Group authored PRs, merged work, issues, reviews, and GitHub-counted activity by upstream repository.</p></div>
        <div className="feature"><h3>One public record</h3><p>HTML for people, SVG for GitHub READMEs, and JSON for agents all come from the same documented work model.</p></div>
      </div></div></section>
      <section className="section"><div className="shell"><div className="panel"><h2>Paste once if you own the profile</h2><p className="section-intro">A Ginmap works without an account. Owners can claim theirs later to hide noise, pin representative work, control indexing, and copy a stable README card.</p><a className="button" href="https://github.com/ginbing/Ginmap">View source</a></div></div></section>
    </>
  );
}
