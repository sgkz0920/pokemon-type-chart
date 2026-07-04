/*
作成日: 2026-07-04
処理名称: サイトロゴ・アイコン生成スクリプト
処理概要: data/types.json の18タイプのイメージカラーから、タイプ色リング＋
          防御シールド（×2）のエンブレムSVG（src/renderer/assets/logo.svg）を生成し、
          Electron（playwright-core）でラスタライズして favicon-32.png と
          apple-touch-icon.png（180px・不透明背景）を出力する。
          実行方法: node scripts/generate_icons.mjs
ファイル名: generate_icons.mjs
*/
import { _electron as electron } from "playwright-core";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.join(__dirname, "..");
const assetsDir = path.join(appRoot, "src", "renderer", "assets");

/* ---- エンブレムSVGの構築 ---- */

const { types } = JSON.parse(
  await readFile(path.join(appRoot, "data", "types.json"), "utf8")
);

const CX = 256;
const CY = 256;
const R_OUT = 236; // リング外径
const R_IN = 180;  // リング内径
const GAP = 3;     // セグメント間の隙間（度）

const rad = (deg) => (deg * Math.PI) / 180;
const pt = (r, deg) =>
  `${(CX + r * Math.cos(rad(deg))).toFixed(2)} ${(CY + r * Math.sin(rad(deg))).toFixed(2)}`;

// 12時位置から時計回りに、types.json の定義順で18セグメントを描く
const segments = types
  .map((t, i) => {
    const a0 = -90 + i * 20 + GAP / 2;
    const a1 = -90 + (i + 1) * 20 - GAP / 2;
    const d =
      `M ${pt(R_OUT, a0)} ` +
      `A ${R_OUT} ${R_OUT} 0 0 1 ${pt(R_OUT, a1)} ` +
      `L ${pt(R_IN, a1)} ` +
      `A ${R_IN} ${R_IN} 0 0 0 ${pt(R_IN, a0)} Z`;
    return `    <path d="${d}" fill="${t.color}"><title>${t.name}</title></path>`;
  })
  .join("\n");

const svg = `<!--
作成日: 2026-07-04
処理名称: サイトエンブレム（タイプ色リング＋防御シールド）
処理概要: 18タイプのイメージカラーのリングと、防御側の相性倍率を象徴する
          シールド（×2）を組み合わせたエンブレム。ヘッダーロゴおよび
          faviconとして使用する。scripts/generate_icons.mjs により生成。
ファイル名: logo.svg
-->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="ポケモンタイプ相性チェッカーのエンブレム">
  <g>
${segments}
  </g>
  <circle cx="256" cy="256" r="168" fill="#f7f9fc"/>
  <path d="M256 138 L352 172 V262 C352 322 312 356 256 378 C200 356 160 322 160 262 V172 Z"
        fill="#2b3240"/>
  <text x="256" y="296" text-anchor="middle" fill="#ffffff"
        font-family="'Segoe UI', 'Hiragino Kaku Gothic ProN', Meiryo, sans-serif"
        font-size="116" font-weight="700">&#215;2</text>
</svg>
`;

await mkdir(assetsDir, { recursive: true });
await writeFile(path.join(assetsDir, "logo.svg"), svg, "utf8");
console.log("logo.svg を生成しました");

/* ---- ElectronでのPNGラスタライズ ---- */

// 対象: [出力ファイル名, 一辺のピクセル数, 背景色（nullなら透過）]
const targets = [
  ["favicon-32.png", 32, null],
  ["apple-touch-icon.png", 180, "#2b3240"],
];

// VS Code配下などでは ELECTRON_RUN_AS_NODE=1 が設定されており、
// ElectronがNodeとして起動してしまうため必ず除去する
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({ args: ["."], cwd: appRoot, env });
const page = await app.firstWindow();

for (const [name, size, bg] of targets) {
  // apple-touch-icon はiOSが透過を黒背景化するため不透明背景＋少し余白を持たせる
  const scale = bg ? 0.86 : 1;
  const inner = Math.round(size * scale);
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
    <body style="margin:0;background:${bg ?? "transparent"};width:${size}px;height:${size}px;
                 display:flex;align-items:center;justify-content:center;">
      <img src="./assets/logo.svg" style="width:${inner}px;height:${inner}px;">
    </body></html>`;
  await page.goto(
    "data:text/html;charset=utf-8," + encodeURIComponent(html)
  );
  // data URLでは相対パスが解決できないため、SVGを直接データURLで埋め込む
  const svgUrl =
    "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  await page.evaluate((url) => {
    document.querySelector("img").src = url;
    return new Promise((resolve) => {
      const img = document.querySelector("img");
      if (img.complete) resolve();
      else img.onload = () => resolve();
    });
  }, svgUrl);
  await page.setViewportSize({ width: size, height: size });
  const buf = await page.screenshot({
    clip: { x: 0, y: 0, width: size, height: size },
    omitBackground: bg === null,
  });
  await writeFile(path.join(assetsDir, name), buf);
  console.log(`${name} を生成しました (${size}x${size})`);
}

await app.close();
console.log("アイコン生成が完了しました");
