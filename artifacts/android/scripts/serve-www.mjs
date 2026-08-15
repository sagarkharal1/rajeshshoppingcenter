/*
 * Serves the staged ./www folder — the exact payload that ships inside the
 * APK — over http://localhost, so the packaged app can be exercised in a
 * browser without an emulator or a phone.
 *
 * The environment matches the WebView closely enough to be worth trusting:
 * the origin is localhost (so registerPwaServiceWorker() skips, as it does in
 * the app), and the injected shim sends every /api call cross-origin to the
 * live server, which is what the APK does too.
 */
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

// Defaults to the staged APK payload. A path argument points it at any other
// build — the web app's own dist, for instance, to check the download page.
const root = process.argv[2]
  ? resolve(process.cwd(), process.argv[2])
  : resolve(here, "..", "www");

const port = Number(process.env.PORT ?? 4173);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

async function resolveFile(pathname) {
  // Strip the leading slash and normalise before joining, so a request for
  // /../../etc cannot climb out of the served folder.
  const relative = normalize(decodeURIComponent(pathname)).replace(/^([/\\.]+)/, "");
  const candidate = join(root, relative);

  if (!candidate.startsWith(root)) return null;

  try {
    const info = await stat(candidate);
    if (info.isFile()) return candidate;

    // A directory means an index.html inside it, if there is one — the same
    // resolution a static host does for /app/.
    if (info.isDirectory()) {
      const index = join(candidate, "index.html");
      if ((await stat(index)).isFile()) return index;
    }
  } catch {
    // Falls through to the SPA entry point below.
  }

  return null;
}

// Serving the website build (rather than the APK payload) means there is no
// injected shim rewriting /api, and the SPA catch-all below would answer API
// calls with index.html — the app then calls .filter on a string of HTML and
// the whole page falls into its error boundary. Forwarding upstream keeps the
// preview honest.
const API_ORIGIN = process.env.RAJESH_API_ORIGIN ?? "https://rajeshshoppingcenter.com.np";

const server = createServer(async (req, res) => {
  const { pathname, search } = new URL(req.url, `http://localhost:${port}`);

  if (pathname.startsWith("/api/")) {
    try {
      const upstream = await fetch(`${API_ORIGIN}${pathname}${search}`, {
        method: req.method,
        headers: { accept: req.headers.accept ?? "application/json" },
      });
      const body = Buffer.from(await upstream.arrayBuffer());
      res.writeHead(upstream.status, {
        "Content-Type": upstream.headers.get("content-type") ?? "application/json",
        "Content-Length": body.length,
        "Cache-Control": "no-store",
      });
      res.end(req.method === "HEAD" ? undefined : body);
    } catch {
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "upstream unreachable" }));
    }
    return;
  }

  // The app routes in the browser, so /catalog and friends have no file on
  // disk. Same reason .do/app.yaml sets catchall_document on the live site.
  const file = (await resolveFile(pathname)) ?? join(root, "index.html");
  const { size } = await stat(file);

  res.writeHead(200, {
    "Content-Type": TYPES[extname(file)] ?? "application/octet-stream",
    // Set explicitly so a HEAD request can report the download size, which is
    // what the install page asks for rather than hardcoding a number.
    "Content-Length": size,
    "Cache-Control": "no-store",
  });

  if (req.method === "HEAD") {
    res.end();
    return;
  }

  createReadStream(file).pipe(res);
});

server.listen(port, () => {
  console.log(`Serving APK payload from ${root}`);
  console.log(`  http://localhost:${port}`);
});
