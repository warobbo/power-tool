"use strict";

const fs = require("fs");
const { spawn } = require("child_process");
const path = require("path");

function sleep(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.next = 1;
    this.pending = new Map();
    this.listeners = [];
    const self = this;
    ws.addEventListener("message", function (event) {
      const raw = typeof event.data === "string" ? event.data : Buffer.from(event.data).toString("utf8");
      const message = JSON.parse(raw);
      if (message.id && self.pending.has(message.id)) {
        const pending = self.pending.get(message.id);
        self.pending.delete(message.id);
        if (message.error) pending.reject(new Error(JSON.stringify(message.error)));
        else pending.resolve(message.result || {});
        return;
      }
      self.listeners.forEach(function (listener) {
        listener(message);
      });
    });
  }

  send(method, params, sessionId) {
    const id = this.next++;
    const payload = { id: id, method: method, params: params || {} };
    if (sessionId) payload.sessionId = sessionId;
    const self = this;
    return new Promise(function (resolve, reject) {
      self.pending.set(id, { resolve: resolve, reject: reject });
      self.ws.send(JSON.stringify(payload));
    });
  }

  waitFor(method, sessionId, timeoutMs) {
    const self = this;
    return new Promise(function (resolve, reject) {
      const timer = setTimeout(function () {
        remove();
        reject(new Error("Timed out waiting for " + method));
      }, timeoutMs || 20000);
      function onMessage(message) {
        if (message.method !== method) return;
        if (sessionId && message.sessionId !== sessionId) return;
        clearTimeout(timer);
        remove();
        resolve(message.params || {});
      }
      function remove() {
        self.listeners = self.listeners.filter(function (listener) {
          return listener !== onMessage;
        });
      }
      self.listeners.push(onMessage);
    });
  }
}

class Page {
  constructor(cdp, sessionId) {
    this.cdp = cdp;
    this.sessionId = sessionId;
  }

  async navigate(url) {
    const loaded = this.cdp.waitFor("Page.loadEventFired", this.sessionId, 30000);
    const result = await this.cdp.send("Page.navigate", { url: url }, this.sessionId);
    if (result.errorText) throw new Error(result.errorText);
    await loaded;
  }

  async evaluate(expression) {
    const result = await this.cdp.send(
      "Runtime.evaluate",
      { expression: expression, returnByValue: true, awaitPromise: true },
      this.sessionId
    );
    if (result.exceptionDetails) {
      const text =
        (result.exceptionDetails.exception && result.exceptionDetails.exception.description) ||
        result.exceptionDetails.text;
      throw new Error(text || "Page script failed");
    }
    return result.result ? result.result.value : undefined;
  }

  async waitFor(expression, timeoutMs) {
    const start = Date.now();
    const limit = timeoutMs || 20000;
    while (Date.now() - start < limit) {
      const value = await this.evaluate(expression);
      if (value) return value;
      await sleep(200);
    }
    throw new Error("Timed out waiting for " + expression);
  }

  async click(selector) {
    const expression =
      "(() => { const el = document.querySelector(" +
      JSON.stringify(selector) +
      "); if (!el) return null; el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' }); const rect = el.getBoundingClientRect(); return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, w: rect.width, h: rect.height, top: rect.top, bottom: rect.bottom, innerHeight: window.innerHeight }; })()";
    let point = await this.evaluate(expression);
    const started = Date.now();
    while (point && (point.top < 0 || point.bottom > point.innerHeight) && Date.now() - started < 3000) {
      await sleep(100);
      point = await this.evaluate(expression);
    }
    if (!point || point.w < 1 || point.h < 1 || point.y < 0 || point.y > point.innerHeight) {
      throw new Error("Not clickable: " + selector + " " + JSON.stringify(point));
    }
    const x = point.x;
    const y = point.y;
    await this.cdp.send(
      "Input.dispatchMouseEvent",
      { type: "mouseMoved", x: x, y: y },
      this.sessionId
    );
    await this.cdp.send(
      "Input.dispatchMouseEvent",
      { type: "mousePressed", x: x, y: y, button: "left", clickCount: 1 },
      this.sessionId
    );
    await this.cdp.send(
      "Input.dispatchMouseEvent",
      { type: "mouseReleased", x: x, y: y, button: "left", clickCount: 1 },
      this.sessionId
    );
    await sleep(80);
  }

  async key(key, code, virtualKey, modifiers) {
    const down = {
      type: "keyDown",
      key: key,
      code: code,
      windowsVirtualKeyCode: virtualKey,
      nativeVirtualKeyCode: virtualKey,
      modifiers: modifiers || 0,
    };
    const up = Object.assign({}, down, { type: "keyUp" });
    await this.cdp.send("Input.dispatchKeyEvent", down, this.sessionId);
    await this.cdp.send("Input.dispatchKeyEvent", up, this.sessionId);
  }

  async fill(selector, value) {
    await this.click(selector);
    await this.key("a", "KeyA", 65, 2);
    await this.key("Backspace", "Backspace", 8, 0);
    const wanted = String(value);
    for (let i = 0; i < 12; i += 1) {
      const current = await this.evaluate(
        "document.querySelector(" + JSON.stringify(selector) + ").value"
      );
      if (!current) break;
      await this.key("Backspace", "Backspace", 8, 0);
    }
    await this.cdp.send("Input.insertText", { text: wanted }, this.sessionId);
    await sleep(50);
    const actual = await this.evaluate(
      "document.querySelector(" + JSON.stringify(selector) + ").value"
    );
    if (String(actual) !== wanted) {
      throw new Error("Fill " + selector + " left " + JSON.stringify(actual) + ", wanted " + wanted);
    }
    await this.key("Tab", "Tab", 9, 0);
    await sleep(80);
  }

  async screenshot(file) {
    const shot = await this.cdp.send(
      "Page.captureScreenshot",
      { format: "png", captureBeyondViewport: true },
      this.sessionId
    );
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, Buffer.from(shot.data, "base64"));
  }
}

async function launchChrome(userDataDir) {
  fs.rmSync(userDataDir, { recursive: true, force: true });
  fs.mkdirSync(userDataDir, { recursive: true });
  const chrome = process.env.CHROME_PATH || "google-chrome";
  const child = spawn(
    chrome,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--remote-debugging-port=0",
      "--remote-allow-origins=*",
      "--user-data-dir=" + userDataDir,
      "--window-size=1280,900",
      "--no-first-run",
      "--no-default-browser-check",
      "about:blank",
    ],
    { stdio: "ignore" }
  );
  const portFile = path.join(userDataDir, "DevToolsActivePort");
  const started = Date.now();
  let port = "";
  let wsPath = "";
  while (Date.now() - started < 15000) {
    if (fs.existsSync(portFile)) {
      const lines = fs.readFileSync(portFile, "utf8").trim().split(/\n/);
      if (lines[0] && lines[1]) {
        port = lines[0].trim();
        wsPath = lines[1].trim();
        break;
      }
    }
    if (child.exitCode != null) throw new Error("Chrome exited before DevTools opened");
    await sleep(100);
  }
  if (!port) throw new Error("Chrome did not write DevToolsActivePort");
  const ws = new WebSocket("ws://127.0.0.1:" + port + wsPath);
  await new Promise(function (resolve, reject) {
    const timer = setTimeout(function () {
      reject(new Error("DevTools websocket did not open"));
    }, 10000);
    ws.addEventListener("open", function () {
      clearTimeout(timer);
      resolve();
    });
    ws.addEventListener("error", function () {
      clearTimeout(timer);
      reject(new Error("DevTools websocket failed"));
    });
  });
  const cdp = new Cdp(ws);
  const created = await cdp.send("Target.createTarget", { url: "about:blank" });
  const attached = await cdp.send("Target.attachToTarget", {
    targetId: created.targetId,
    flatten: true,
  });
  const sessionId = attached.sessionId;
  await cdp.send("Page.enable", {}, sessionId);
  await cdp.send("Runtime.enable", {}, sessionId);
  await cdp.send("DOM.enable", {}, sessionId);
  await cdp.send(
    "Emulation.setDeviceMetricsOverride",
    { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false },
    sessionId
  );
  const page = new Page(cdp, sessionId);
  return {
    pid: child.pid,
    child: child,
    ws: ws,
    page: page,
    async close() {
      try {
        ws.close();
      } catch (err) {
        /* already closed */
      }
      if (child.exitCode == null) child.kill("SIGTERM");
    },
  };
}

module.exports = { launchChrome: launchChrome };
