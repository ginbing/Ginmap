# Security

Please do not open public issues for vulnerabilities that could expose OAuth tokens, session secrets, or user data. Report security issues privately to the maintainers through the GitHub security advisory flow for this repository.

Ginmap v1 is designed around public GitHub data. The hosted service does not request private repository or repository write access. OAuth tokens are encrypted before database storage, session cookies are HTTP-only, and public endpoints never expose hidden repositories or authentication state.
