/*
作成日: 2026-07-04
処理名称: ポケモンタイプ相性チェッカー メインプロセス
処理概要: Electronアプリケーションのエントリポイント。ウィンドウの生成と、
          data/ 配下のタイプ相性・特性JSONをレンダラーへ提供するIPCハンドラを定義する。
ファイル名: main.js
*/
import { app, BrowserWindow, ipcMain } from "electron";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.join(__dirname, "..", "..");

// data/ 配下のJSONを読み込み、レンダラーへ渡す1オブジェクトに統合する
async function loadData() {
  const [typesJson, abilitiesJson] = await Promise.all([
    readFile(path.join(appRoot, "data", "types.json"), "utf-8"),
    readFile(path.join(appRoot, "data", "abilities.json"), "utf-8"),
  ]);
  const { types, chart } = JSON.parse(typesJson);
  const { abilities } = JSON.parse(abilitiesJson);
  return { types, chart, abilities };
}

function createWindow() {
  const win = new BrowserWindow({
    width: 920,
    height: 900,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.loadFile(path.join(appRoot, "src", "renderer", "index.html"));
}

app.whenReady().then(() => {
  ipcMain.handle("get-data", loadData);
  createWindow();

  // macOS: Dockクリックでウィンドウ再生成（他OSでは何もしない）
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
