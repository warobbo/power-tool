#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const lib = require("./lib");

async function main() {
  const instance = lib.requireInstance();
  const rows = [];
  let ok = true;

  for (const item of lib.REDIRECT_CASES) {
    const response = await lib.requestOnce(instance.baseUrl + item.path);
    const pass = response.status === 301 && response.location === item.location;
    if (!pass) ok = false;
    rows.push({
      path: item.path,
      status: response.status,
      location: response.location,
      expectedStatus: 301,
      expectedLocation: item.location,
      pass: pass,
    });
    console.log((pass ? "ok  " : "FAIL ") + response.status + " " + item.path + " -> " + response.location);
  }

  for (const filePath of lib.FILE_CASES) {
    const response = await lib.requestOnce(instance.baseUrl + filePath);
    const pass = response.status === 200 && response.location === "";
    if (!pass) ok = false;
    rows.push({
      path: filePath,
      status: response.status,
      location: response.location,
      expectedStatus: 200,
      expectedLocation: "",
      pass: pass,
    });
    console.log((pass ? "ok  " : "FAIL ") + response.status + " " + filePath);
  }

  for (const item of lib.HIDDEN_CASES) {
    const response = await lib.requestOnce(instance.baseUrl + item.path);
    const pass = response.status === 301 && response.location === item.location && response.status !== 200;
    if (!pass) ok = false;
    rows.push({
      path: item.path,
      status: response.status,
      location: response.location,
      expectedStatus: 301,
      expectedLocation: item.location,
      pass: pass,
    });
    console.log((pass ? "ok  " : "FAIL ") + response.status + " " + item.path + " -> " + response.location);
  }

  const evidence = lib.evidenceDir(instance.runId);
  fs.mkdirSync(evidence, { recursive: true });
  const file = path.join(evidence, "redirects.json");
  fs.writeFileSync(
    file,
    JSON.stringify(
      {
        baseUrl: instance.baseUrl,
        runId: instance.runId,
        checkedAt: new Date().toISOString(),
        rows: rows,
      },
      null,
      2
    ) + "\n"
  );
  console.log("evidence " + file);
  if (!ok) process.exit(1);
}

main().catch(function (err) {
  console.error(err.message || err);
  process.exit(1);
});
