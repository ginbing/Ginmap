function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export async function GET(_request: Request, { params }: { params: Promise<{ login: string }> }) {
  const { login } = await params;
  const safeLogin = escapeHtml(login);
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${safeLogin}'s GitHub work map · Ginmap</title>
<style>html,body{margin:0;padding:0;background:transparent}body{padding:1px}</style>
<script type="module" src="/widget.js"></script>
</head>
<body>
<gin-map username="${safeLogin}" view="full" theme="auto"></gin-map>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
      "Content-Security-Policy": "default-src 'none'; script-src 'self'; connect-src 'self'; img-src https://avatars.githubusercontent.com data:; style-src 'unsafe-inline'; frame-ancestors *; base-uri 'none'; form-action 'none'",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
