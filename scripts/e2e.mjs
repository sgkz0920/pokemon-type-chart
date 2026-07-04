/*
作成日: 2026-07-04
処理名称: ポケモンタイプ相性チェッカー E2E検証スクリプト
処理概要: Playwright（_electron）でElectronアプリを実起動し、追加設計書
          （Electron移行・UI改善）9.2章 E1〜E5 を検証する。あわせてREADME用の
          スクリーンショット（ライト／ダーク／モバイル幅）を取得する。
          実行方法: npm run test:e2e
ファイル名: e2e.mjs
*/
import { _electron as electron } from "playwright-core";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.join(__dirname, "..");
const shotDir = process.env.E2E_SHOT_DIR || path.join(appRoot, "doc", "images");

let passed = 0;
function ok(label) {
  passed++;
  console.log(`  ✔ ${label}`);
}

async function launch() {
  // VS Code配下などでは ELECTRON_RUN_AS_NODE=1 が設定されており、
  // ElectronがNodeとして起動してしまうため必ず除去する
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({ args: ["."], cwd: appRoot, env });
  const page = await app.firstWindow();
  await page.waitForSelector(".type-btn"); // データ読込・初期描画完了を待つ
  return { app, page };
}

const typeBtn = (page, name) => page.locator(".type-btn", { hasText: name });

console.log("E2E検証を開始します");
let { app, page } = await launch();

/* ---- E1: 起動・データ読込 ---- */
assert.equal(await page.locator(".type-btn").count(), 18);
assert.equal(await page.locator("#ability-select option").count(), 17);
assert.equal(await page.title(), "ポケモンタイプ相性チェッカー");
ok("E1: 18タイプボタンと特性セレクト（17件）が表示される");

/* ---- E2: 相性計算表示（みず＋じめん） ---- */
await typeBtn(page, "みず").click();
await typeBtn(page, "じめん").click();
const firstGroup = page.locator(".result-group").first();
assert.equal(await firstGroup.locator("h3").innerText(), "4倍（こうかばつぐん）");
assert.equal(await firstGroup.locator(".type-badge").innerText(), "くさ");
const lastGroup = page.locator(".result-group").last();
assert.equal(await lastGroup.locator("h3").innerText(), "無効（こうかなし）");
assert.equal(await lastGroup.locator(".type-badge").innerText(), "でんき");
ok("E2: みず＋じめんで 4倍=くさ / 無効=でんき が表示される");

/* ---- 特性補正の画面反映（いわ＋こおり＋フィルター） ---- */
await page.locator("#clear-btn").click();
await typeBtn(page, "いわ").click();
await typeBtn(page, "こおり").click();
await page.locator("#ability-select").selectOption("filter");
assert.equal(
  await page.locator(".result-group h3").first().innerText(),
  "3倍（こうかばつぐん）"
);
assert.ok((await page.locator("#ability-note").innerText()).includes("フィルター"));
ok("E2+: フィルター選択で4倍が3倍に補正されて表示される");

/* ---- スクリーンショット（README用: ライト） ---- */
await page.screenshot({ path: path.join(shotDir, "screenshot_desktop.png") });

/* ---- E4: クリアボタン（相性倍率エリアに配置・リセット動作） ---- */
assert.equal(await page.locator("#status-panel #clear-btn").count(), 0);
assert.equal(await page.locator("#result-panel #clear-btn").count(), 1);
await page.locator("#clear-btn").click();
assert.equal(await page.locator(".type-btn.selected").count(), 0);
assert.equal(await page.locator("#ability-select").inputValue(), "none");
assert.ok((await page.locator("#result-body").innerText()).includes("防御側のタイプを選択してください"));
assert.ok(await page.locator("#clear-btn").isDisabled());
ok("E4: クリアボタンは相性倍率エリアにあり、タイプ・特性をリセットする");

/* ---- E5: 単タイプ確定（選択数1で同一タイプ再クリックしても解除されない） ---- */
await typeBtn(page, "ほのお").click();
await typeBtn(page, "ほのお").click();
assert.equal(await page.locator(".type-btn.selected").count(), 1);
assert.ok((await page.locator("#status-slots").innerText()).includes("ほのお"));
// 選択数2のときは従来どおり解除できる
await typeBtn(page, "みず").click();
await typeBtn(page, "みず").click();
assert.equal(await page.locator(".type-btn.selected").count(), 1);
ok("E5: 単タイプ再クリックは解除されず、2タイプ時の解除は従来どおり");

/* ---- E3: ダークモード切替 ---- */
const initialTheme = await page.evaluate(() => document.documentElement.dataset.theme);
await page.locator("#theme-toggle").click();
const toggledTheme = await page.evaluate(() => document.documentElement.dataset.theme);
assert.notEqual(initialTheme, toggledTheme);

// ダーク状態でスクリーンショットを撮るため、いったんダークに揃える
if (toggledTheme !== "dark") await page.locator("#theme-toggle").click();
await typeBtn(page, "いわ").click();
await typeBtn(page, "こおり").click();
await page.locator("#ability-select").selectOption("filter");
await page.screenshot({ path: path.join(shotDir, "screenshot_dark.png") });

// ダーク設定のまま再起動し、テーマが復元されることを確認
await app.close();
({ app, page } = await launch());
assert.equal(
  await page.evaluate(() => document.documentElement.dataset.theme),
  "dark"
);
ok("E3: テーマ切替が動作し、再起動後もダークモードが維持される");

/* ---- スクリーンショット（README用: モバイル幅・ライト） ---- */
await page.locator("#theme-toggle").click(); // ライトに戻す（次回起動もライト）
await app.evaluate(({ BrowserWindow }) => {
  const win = BrowserWindow.getAllWindows()[0];
  win.setSize(390, 844);
});
await typeBtn(page, "みず").click();
await typeBtn(page, "じめん").click();
await page.locator("#ability-select").selectOption("water-absorb");
await page.waitForTimeout(600); // スムーズスクロールの完了待ち
await page.screenshot({ path: path.join(shotDir, "screenshot_mobile.png") });
ok("スクリーンショット3点（ライト／ダーク／モバイル幅）を取得");

await app.close();
console.log(`E2E検証 完了: ${passed}件すべて成功`);
