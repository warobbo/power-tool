#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const lib = require("./lib");

const id = lib.runId();
const dir = lib.runDir(id);
const instance = lib.readInstance(id);
const evidence = lib.evidenceDir(id);

if (instance) {
  try {
    if (lib.killIfMatches(instance.pid, "serve.js")) {
      console.log("stopped server pid " + instance.pid);
    } else {
      console.log("server pid " + instance.pid + " was already stopped");
    }
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
} else {
  console.log("no server instance for run " + id);
}

const chromeFile = path.join(dir, "chrome.pid");
if (fs.existsSync(chromeFile)) {
  const chromePid = Number(fs.readFileSync(chromeFile, "utf8"));
  try {
    if (lib.killIfMatches(chromePid, dir)) {
      console.log("stopped chrome pid " + chromePid);
    }
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

if (fs.existsSync(dir)) {
  fs.rmSync(dir, { recursive: true, force: true });
  console.log("removed " + dir);
}

if (fs.existsSync(evidence)) {
  console.log("kept evidence " + evidence);
} else {
  console.log("no evidence directory at " + evidence);
}
