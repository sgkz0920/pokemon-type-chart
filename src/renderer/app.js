/*
作成日: 2026-07-04
処理名称: ポケモンタイプ相性チェッカー 表示層・状態管理
処理概要: データ読込（Electron IPC / ブラウザfetchの両対応）、選択状態の管理、
          テーマ切替、自動スクロール、およびDOM描画を行う。
          倍率計算などの純粋関数は logic.js に分離している。
ファイル名: app.js
*/
import {
  calcMultipliers,
  applyAbility,
  groupByMultiplier,
  groupLabel,
  groupColor,
} from "./logic.js";

/* ================= データ読込 ================= */

// Electron（preloadのpokeApi）とブラウザ（fetch）の両対応
async function loadData() {
  if (window.pokeApi) return window.pokeApi.getData();
  const [typesRes, abilitiesRes] = await Promise.all([
    fetch("../../data/types.json"),
    fetch("../../data/abilities.json"),
  ]);
  const { types, chart } = await typesRes.json();
  const { abilities } = await abilitiesRes.json();
  return { types, chart, abilities };
}

/* ================= 状態管理 ================= */

let data = null;                  // { types, chart, abilities }
let selectedTypes = [];           // 選択中の防御タイプID（選択順を保持、長さ0〜2）
let selectedAbilityId = "none";   // 選択中の特性ID（常に1件）

const THEME_KEY = "pokemon-type-chart-theme";

/* ================= DOM参照 ================= */

const typePanel = document.getElementById("type-panel");
const statusPanel = document.getElementById("status-panel");
const typeGrid = document.getElementById("type-grid");
const statusSlots = document.getElementById("status-slots");
const resultBody = document.getElementById("result-body");
const clearBtn = document.getElementById("clear-btn");
const abilitySelect = document.getElementById("ability-select");
const abilityNote = document.getElementById("ability-note");
const themeToggle = document.getElementById("theme-toggle");

/* ================= テーマ切替（F-08） ================= */

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeToggle.textContent = theme === "dark" ? "🌙" : "💡";
  themeToggle.setAttribute(
    "aria-label",
    theme === "dark" ? "ライトモードに切り替え" : "ダークモードに切り替え"
  );
}

function toggleTheme() {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(next);
  try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* 保存不可でも動作は継続 */ }
}

/* ================= 自動スクロール（F-09） ================= */

// 対象エリアが画面内に完全に収まっていない場合のみスクロールする
// （PC等の大画面では実質無効。スマホでの操作導線を想定）
function scrollToPanelIfNeeded(panel) {
  const rect = panel.getBoundingClientRect();
  const fullyVisible = rect.top >= 0 && rect.bottom <= window.innerHeight;
  if (!fullyVisible) panel.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ================= 操作ロジック ================= */

// タイプ選択（F-01）:
//   未選択タイプ → 選択（3つ目はFIFOで最古を解除）。2つ目確定でステータスへスクロール（S1）
//   選択中タイプ（選択数2）→ 解除
//   選択中タイプ（選択数1）→ 単タイプ確定として扱い、ステータスへスクロール（S2）
function toggleType(typeId) {
  const index = selectedTypes.indexOf(typeId);
  if (index !== -1) {
    if (selectedTypes.length === 1) {
      scrollToPanelIfNeeded(statusPanel);
      return;
    }
    selectedTypes.splice(index, 1);
    renderAll();
    return;
  }
  if (selectedTypes.length === 2) selectedTypes.shift();
  selectedTypes.push(typeId);
  renderAll();
  if (selectedTypes.length === 2) scrollToPanelIfNeeded(statusPanel);
}

// 選択クリア（F-05）: タイプと特性をリセットし、タイプ選択エリアへスクロール（S3）
function clearSelection() {
  selectedTypes = [];
  selectedAbilityId = "none";
  renderAll();
  scrollToPanelIfNeeded(typePanel);
}

/* ================= 表示層 ================= */

// タイプボタンの初期生成（初回のみ）
function buildTypePanel() {
  for (const type of data.types) {
    const btn = document.createElement("button");
    btn.className = "type-btn";
    btn.dataset.typeId = type.id;
    btn.textContent = type.name;
    btn.style.background = type.color;
    btn.style.color = type.darkText ? "#2b3240" : "#ffffff";
    btn.addEventListener("click", () => toggleType(type.id));
    typeGrid.appendChild(btn);
  }
}

// 特性ドロップダウンの初期生成（初回のみ）
function buildAbilitySelect() {
  for (const ability of data.abilities) {
    const opt = document.createElement("option");
    opt.value = ability.id;
    opt.textContent = ability.name;
    abilitySelect.appendChild(opt);
  }
  abilitySelect.addEventListener("change", () => {
    selectedAbilityId = abilitySelect.value;
    renderAll();
  });
}

// ボタンの選択状態を反映
function renderTypePanel() {
  for (const btn of typeGrid.children) {
    btn.classList.toggle(
      "selected",
      selectedTypes.includes(Number(btn.dataset.typeId))
    );
  }
}

// 選択ステータス表示（F-04）
function renderStatus() {
  statusSlots.innerHTML = "";
  for (let slot = 0; slot < 2; slot++) {
    if (slot === 1) {
      const cross = document.createElement("span");
      cross.className = "status-cross";
      cross.textContent = "×";
      statusSlots.appendChild(cross);
    }
    const el = document.createElement("span");
    el.className = "status-slot";
    const typeId = selectedTypes[slot];
    if (typeId === undefined) {
      el.classList.add("empty");
      el.textContent = slot === 0 ? "タイプ1を選択" : "タイプ2（任意）";
    } else {
      const type = data.types[typeId];
      el.textContent = type.name;
      el.style.background = type.color;
      el.style.color = type.darkText ? "#2b3240" : "#ffffff";
    }
    statusSlots.appendChild(el);
  }
  clearBtn.disabled = selectedTypes.length === 0 && selectedAbilityId === "none";

  // 特性セレクトと効果説明の反映
  abilitySelect.value = selectedAbilityId;
  const ability = data.abilities.find((a) => a.id === selectedAbilityId);
  abilityNote.textContent = ability.description
    ? `ⓘ ${ability.name}: ${ability.description}`
    : "";
}

// 結果表示（F-03）
function renderResult() {
  resultBody.innerHTML = "";
  if (selectedTypes.length === 0) {
    const msg = document.createElement("p");
    msg.id = "result-empty";
    msg.textContent = "防御側のタイプを選択してください";
    resultBody.appendChild(msg);
    return;
  }

  const ability = data.abilities.find((a) => a.id === selectedAbilityId);
  const multipliers = applyAbility(calcMultipliers(data.chart, selectedTypes), ability);
  const groups = groupByMultiplier(data.types, multipliers);
  for (const [value, ids] of groups) {
    const groupEl = document.createElement("div");
    groupEl.className = "result-group";
    groupEl.style.setProperty("--group-color", groupColor(value));

    const heading = document.createElement("h3");
    heading.textContent = groupLabel(value);
    groupEl.appendChild(heading);

    const list = document.createElement("div");
    list.className = "badge-list";
    for (const id of ids) {
      const type = data.types[id];
      const badge = document.createElement("span");
      badge.className = "type-badge";
      badge.textContent = type.name;
      badge.style.background = type.color;
      badge.style.color = type.darkText ? "#2b3240" : "#ffffff";
      list.appendChild(badge);
    }
    groupEl.appendChild(list);
    resultBody.appendChild(groupEl);
  }
}

// 一括再描画
function renderAll() {
  renderTypePanel();
  renderStatus();
  renderResult();
}

/* ================= 初期化 ================= */

async function init() {
  applyTheme(document.documentElement.dataset.theme || "light");
  themeToggle.addEventListener("click", toggleTheme);
  clearBtn.addEventListener("click", clearSelection);

  data = await loadData();
  buildTypePanel();
  buildAbilitySelect();
  renderAll();
}

init();
