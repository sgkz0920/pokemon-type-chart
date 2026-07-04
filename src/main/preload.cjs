/*
作成日: 2026-07-04
処理名称: ポケモンタイプ相性チェッカー preloadスクリプト
処理概要: contextBridgeを通じて、データ取得API（pokeApi.getData）のみを
          レンダラーへ安全に公開する。サンドボックス互換のためCommonJS形式。
ファイル名: preload.cjs
*/
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("pokeApi", {
  getData: () => ipcRenderer.invoke("get-data"),
});
