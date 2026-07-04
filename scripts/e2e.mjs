/*
作成日: 2026-07-04
処理名称: ポケモンタイプ相性チェッカー E2E検証スクリプト
処理概要: Playwright（_electron）でElectronアプリを実起動し、追加設計書
          （Electron移行・UI改善）9.2章 E1〜E5、追加設計書（モバイルUI改善・
          不具合修正）4章 E6〜E9・6.4章 E10、および追加設計書（ポケモン名検索）
          6.2章 E11〜E12 を検証する。あわせてREADME用の
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

/* ---- E11: タブ切替（選択状態は維持される） ---- */
// E5終了時点の選択: ほのお（1タイプ）
await page.locator("#tab-pokemon").click();
assert.ok(await page.locator("#pokemon-tab-body").isVisible());
assert.ok(await page.locator("#type-tab-body").isHidden());
assert.ok((await page.locator("#status-slots").innerText()).includes("ほのお"));
await page.locator("#tab-type").click();
assert.ok(await page.locator("#type-tab-body").isVisible());
assert.ok(await page.locator("#pokemon-tab-body").isHidden());
assert.equal(await page.locator(".type-btn.selected").count(), 1);
await page.locator("#tab-pokemon").click();
ok("E11: タブ切替で表示が入れ替わり、選択中のタイプは維持される");

/* ---- E12: ポケモン名検索（ひらがな→候補→タイプ設定） ---- */
await page.locator("#pokemon-search").fill("りざーどん");
const firstItem = page.locator(".pokemon-item").first();
assert.ok((await firstItem.innerText()).includes("リザードン"));
await firstItem.click();
const slots = await page.locator("#status-slots").innerText();
assert.ok(slots.includes("ほのお") && slots.includes("ひこう"));
assert.equal(
  await page.locator(".result-group h3").first().innerText(),
  "4倍（こうかばつぐん）"
);
assert.equal(
  await page.locator(".result-group").first().locator(".type-badge").innerText(),
  "いわ"
);
// 選択した候補はハイライトされる
assert.ok(await firstItem.evaluate((el) => el.classList.contains("selected")));
// 以降の検証はタイプ選択タブで行うため戻し、クリアで検索状態もリセットする
await page.locator("#tab-type").click();
await page.locator("#clear-btn").click();
assert.equal(await page.locator("#pokemon-search").inputValue(), "");
ok("E12: ひらがな検索でリザードンを選択でき、ほのお×ひこう・いわ4倍が表示される");

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

await page.locator("#theme-toggle").click(); // ライトに戻す（次回起動もライト）

/* ---- F-12: ズーム抑止のviewport設定 ---- */
const viewport = await page.evaluate(
  () => document.querySelector('meta[name="viewport"]').content
);
assert.ok(viewport.includes("maximum-scale=1.0"));
assert.ok(viewport.includes("user-scalable=no"));
ok("F-12: viewport metaでズーム抑止が指定されている");

/* ---- E6: テーマ切替ボタンの配置（デスクトップ=fixed） ---- */
assert.equal(
  await page.evaluate(
    () => getComputedStyle(document.getElementById("theme-toggle")).position
  ),
  "fixed"
);

/* ---- モバイル幅（390×844）に変更 ---- */
await app.evaluate(({ BrowserWindow }) => {
  const win = BrowserWindow.getAllWindows()[0];
  win.setSize(390, 844);
});
await page.waitForTimeout(200); // リサイズ反映待ち

/* ---- E6: テーマ切替ボタンの配置（モバイル=ページ最上部固定） ---- */
assert.equal(
  await page.evaluate(
    () => getComputedStyle(document.getElementById("theme-toggle")).position
  ),
  "absolute"
);
// スクロールするとボタンはページと一緒に画面外へ流れる
const toggleTopWhenScrolled = await page.evaluate(() => {
  window.scrollTo(0, 300);
  const top = document.getElementById("theme-toggle").getBoundingClientRect().top;
  window.scrollTo(0, 0);
  return top;
});
assert.ok(toggleTopWhenScrolled < 0);
ok("E6: テーマ切替ボタンはデスクトップで画面追随、モバイルでページ最上部固定");

/* ---- E7: 見出しの1行表示（はみ出しなし） ---- */
const h1Fits = await page.evaluate(() => {
  const h1 = document.querySelector("header h1");
  return h1.scrollWidth <= h1.clientWidth;
});
assert.ok(h1Fits, "見出しがモバイル幅で折り返しまたははみ出している");
ok("E7: 見出し「ポケモンタイプ相性チェッカー」がモバイル幅でも1行に収まる");

/* ---- E8: 説明文の2行表示 ---- */
assert.equal(await page.locator(".desc-line").count(), 2);
const descFits = await page.evaluate(() =>
  [...document.querySelectorAll(".desc-line")].every(
    (el) => el.scrollWidth <= el.clientWidth
  )
);
assert.ok(descFits, "説明文がモバイル幅ではみ出している");
ok("E8: 説明文が2行固定で表示され、モバイル幅でも各行が収まる");

/* ---- E9: クリア直後の再選択でもスクロールする（F-11回帰） ---- */
// 実機ではブラウザUIの分ビューポートが低く、上部スクロール後に
// 「選択中のタイプ」エリアが画面外に出る。その条件を再現するため縦を縮める
await app.evaluate(({ BrowserWindow }) => {
  BrowserWindow.getAllWindows()[0].setSize(390, 600);
});
await page.waitForTimeout(200);
const statusVisible = () =>
  page.evaluate(() => {
    const rect = document.getElementById("status-panel").getBoundingClientRect();
    return rect.top >= 0 && rect.bottom <= window.innerHeight;
  });
await typeBtn(page, "みず").click();
await typeBtn(page, "じめん").click();
await page.waitForTimeout(700); // スムーズスクロールの完了待ち
assert.ok(await statusVisible(), "2タイプ選択で選択中エリアへスクロールしていない");
// クリア（上部へのスクロールアニメーション開始直後）に間髪入れず再選択する。
// 実機での素早いタップを再現するため、同一タスク内で連続してクリックする
await page.evaluate(() => {
  document.getElementById("clear-btn").click();
  const fire = [...document.querySelectorAll(".type-btn")].find(
    (b) => b.textContent === "ほのお"
  );
  fire.click();
  fire.click(); // 単タイプ確定
});
await page.waitForTimeout(900);
assert.ok(await statusVisible(), "クリア直後の再選択で選択中エリアへスクロールしていない");
ok("E9: クリア直後（スクロール中）の再選択でも選択中エリアへスクロールする");

/* ---- E10: クリア後はページ最上部へ戻り、再選択でスクロールする（F-15回帰） ---- */
await page.locator("#clear-btn").click();
await page.waitForTimeout(700); // スムーズスクロールの完了待ち
assert.equal(
  await page.evaluate(() => window.scrollY),
  0,
  "クリア後にページ最上部へ戻っていない"
);
await typeBtn(page, "みず").click();
await typeBtn(page, "じめん").click();
await page.waitForTimeout(700);
assert.ok(
  await statusVisible(),
  "クリア（最上部）からの再選択で選択中エリアへスクロールしていない"
);
ok("E10: クリア後はページ最上部へ戻り、そこからの再選択でスクロールする");

/* ---- スクリーンショット（README用: モバイル幅・ライト） ---- */
await app.evaluate(({ BrowserWindow }) => {
  BrowserWindow.getAllWindows()[0].setSize(390, 844);
});
await page.locator("#clear-btn").click();
await page.waitForTimeout(700);
await typeBtn(page, "みず").click();
await typeBtn(page, "じめん").click();
await page.locator("#ability-select").selectOption("water-absorb");
await page.waitForTimeout(700); // スムーズスクロールの完了待ち
await page.screenshot({ path: path.join(shotDir, "screenshot_mobile.png") });
ok("スクリーンショット3点（ライト／ダーク／モバイル幅）を取得");

await app.close();
console.log(`E2E検証 完了: ${passed}件すべて成功`);
