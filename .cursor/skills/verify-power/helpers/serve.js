#!/usr/bin/env node
"use strict";

const fs = require("fs");
const http = require("http");
const path = require("path");
const lib = require("./lib");

const id = lib.runId();
const dir = lib.runDir(id);
fs.mkdirSync(dir, { recursive: true });

const existing = lib.readInstance(id);
if (existing && lib.pidAlive(existing.pid) && lib.cmdline(existing.pid).indexOf("serve.js") !== -1) {
  console.error("verify-power server already running for run " + id + " at " + existing.baseUrl);
  console.error("Use a different POWER_VERIFY_RUN, or stop it with helpers/cleanup.js");
  process.exit(1);
}

const rules = lib.loadRedirects();
const server = http.createServer(function (req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { Allow: "GET, HEAD", "X-Power-Verify": "local-redirect" });
    res.end();
    return;
  }
  const parsed = lib.normalisePath(req.url || "/");
  if (!parsed) {
    res.writeHead(400, { "X-Power-Verify": "local-redirect" });
    res.end("Bad path");
    return;
  }
  const file = lib.publishedFile(parsed.pathname);
  if (file) {
    const body = fs.readFileSync(file);
    res.writeHead(200, {
      "Content-Type": lib.contentType(file),
      "Content-Length": body.length,
      "Cache-Control": "no-store",
      "X-Power-Verify": "local-redirect",
    });
    res.end(req.method === "HEAD" ? undefined : body);
    return;
  }
  const rule = lib.matchRedirect(parsed.pathname, rules);
  if (!rule) {
    res.writeHead(404, { "X-Power-Verify": "local-redirect", "Content-Type": "text/plain; charset=utf-8" });
    res.end("No redirect rule for " + parsed.pathname);
    return;
  }
  const location = rule.destination + parsed.search;
  res.writeHead(rule.status, {
    Location: location,
    "Cache-Control": "no-store",
    "Content-Length": 0,
    "X-Power-Verify": "local-redirect",
  });
  res.end();
});

server.listen(0, "127.0.0.1", function () {
  const port = server.address().port;
  const instance = {
    pid: process.pid,
    port: port,
    runId: id,
    baseUrl: "http://127.0.0.1:" + port,
    startedAt: new Date().toISOString(),
  };
  fs.writeFileSync(lib.instancePath(id), JSON.stringify(instance, null, 2));
  console.log("ready " + instance.baseUrl + " run=" + id);
});

function shutdown() {
  server.close(function () {
    process.exit(0);
  });
  setTimeout(function () {
    process.exit(0);
  }, 500).unref();
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
