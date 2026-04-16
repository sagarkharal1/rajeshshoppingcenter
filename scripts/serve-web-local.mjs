import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve("C:/Users/sandh/OneDrive/Documents/New project/Master-Agent/artifacts/web/dist/public");
const port = 8092;
const apiTarget = "http://127.0.0.1:8080";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webmanifest": "application/manifest+json",
};

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
  fs.createReadStream(filePath).pipe(res);
}

function proxyApi(req, res) {
  const target = new URL(req.url, apiTarget);
  const proxyReq = http.request(
    target,
    {
      method: req.method,
      headers: req.headers,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
      proxyRes.pipe(res);
    },
  );

  proxyReq.on("error", () => {
    res.writeHead(502, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: "Backend API is unavailable" }));
  });

  req.pipe(proxyReq);
}

const server = http.createServer((req, res) => {
  if (!req.url) {
    res.writeHead(400);
    res.end("Bad request");
    return;
  }

  if (req.url.startsWith("/api/")) {
    proxyApi(req, res);
    return;
  }

  let reqPath = decodeURIComponent(req.url.split("?")[0]);
  if (reqPath === "/") reqPath = "/index.html";
  const filePath = path.join(root, reqPath);

  if (filePath.startsWith(root) && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    sendFile(res, filePath);
    return;
  }

  const fallback = path.join(root, "index.html");
  if (fs.existsSync(fallback)) {
    sendFile(res, fallback);
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Not found");
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Local web server running on http://127.0.0.1:${port}`);
});
