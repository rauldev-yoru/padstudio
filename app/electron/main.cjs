/**
 * Electron shell for PadStudio.
 *
 * Responsibilities, in order of importance:
 *   1. own the engine process (start on launch, kill on quit) so the UI never
 *      has to know how the backend is launched;
 *   2. stay alive in the tray when the window is closed, because this is a
 *      device utility, not a document window;
 *   3. load the built UI from disk in production and the Vite dev server in
 *      development (PADSTUDIO_DEV=1).
 */
const { app, BrowserWindow, Menu, Tray, nativeImage, shell } = require("electron");
const path = require("node:path");
const { spawn } = require("node:child_process");

const ENGINE_PORT = 8477;
const DEV = process.env.PADSTUDIO_DEV === "1";

let engine = null;
let win = null;
let tray = null;
let quitting = false;

function startEngine() {
  const root = path.resolve(__dirname, "..", "..");
  engine = spawn("python", ["-m", "engine.app", "--port", String(ENGINE_PORT)], {
    cwd: root,
    windowsHide: true,
    stdio: "ignore",
  });
  engine.on("exit", () => {
    engine = null;
  });
  engine.on("error", (err) => {
    console.error("engine failed to start:", err);
    engine = null;
  });
}

function stopEngine() {
  if (!engine) return;
  try {
    engine.kill();
  } catch {
    /* already gone */
  }
  engine = null;
}

function createWindow() {
  win = new BrowserWindow({
    width: 1320,
    height: 880,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: "#08070d",
    autoHideMenuBar: true,
    title: "PadStudio",
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });

  if (DEV) {
    win.loadURL("http://localhost:5173");
  } else {
    win.loadFile(path.resolve(__dirname, "..", "dist", "index.html"));
  }

  // Closing the window hides it: the tray keeps the app (and the link) alive.
  win.on("close", (event) => {
    if (!quitting) {
      event.preventDefault();
      win.hide();
    }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

function createTray() {
  const iconPath = path.resolve(__dirname, "..", "assets", "tray.png");
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon.resize({ width: 16, height: 16 }));
  tray.setToolTip("PadStudio");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Open PadStudio", click: () => (win ? win.show() : createWindow()) },
      { label: "Reconnect controller", click: () => fetch(`http://127.0.0.1:${ENGINE_PORT}/connect`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).catch(() => {}) },
      { type: "separator" },
      {
        label: "Quit",
        click: () => {
          quitting = true;
          app.quit();
        },
      },
    ]),
  );
  tray.on("click", () => (win && win.isVisible() ? win.hide() : win.show()));
}

app.whenReady().then(() => {
  startEngine();
  createWindow();
  createTray();
});

app.on("before-quit", () => {
  quitting = true;
  stopEngine();
});

// Tray utility: keep running with no windows open.
app.on("window-all-closed", () => {});
