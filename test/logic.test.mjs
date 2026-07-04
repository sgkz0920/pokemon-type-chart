/*
作成日: 2026-07-04
処理名称: ポケモンタイプ相性チェッカー 単体テスト
処理概要: data/ 配下のJSONデータの整合性検証と、logic.js の純粋関数
          （相性計算・特性補正・グルーピング・表示整形）の検証を行う。
          追加設計書（Electron移行・UI改善）9.1章 U1〜U6 に対応。
ファイル名: logic.test.mjs
*/
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  calcMultipliers,
  applyAbility,
  groupByMultiplier,
  formatMultiplier,
  groupLabel,
  groupColor,
} from "../src/renderer/logic.js";

const { types, chart } = JSON.parse(
  await readFile(new URL("../data/types.json", import.meta.url), "utf-8")
);
const { abilities } = JSON.parse(
  await readFile(new URL("../data/abilities.json", import.meta.url), "utf-8")
);

// タイプ名から防御タイプID配列を引くヘルパ
const id = (name) => types.find((t) => t.name === name).id;
const ability = (name) => abilities.find((a) => a.name === name);
const multipliersOf = (typeNames, abilityName = "特性なし") =>
  applyAbility(calcMultipliers(chart, typeNames.map(id)), ability(abilityName));

/* ================= U1・U2: データ検証 ================= */

describe("U1: types.json の整合性", () => {
  test("タイプは18種で、idが配列インデックスと一致する", () => {
    assert.equal(types.length, 18);
    types.forEach((t, i) => assert.equal(t.id, i));
  });

  test("各タイプは名前とカラーコード（#RRGGBB）を持つ", () => {
    for (const t of types) {
      assert.ok(t.name.length > 0);
      assert.match(t.color, /^#[0-9A-Fa-f]{6}$/);
      assert.equal(typeof t.darkText, "boolean");
    }
  });

  test("相性表は18×18で、値は 0 / 0.5 / 1 / 2 のいずれか", () => {
    assert.equal(chart.length, 18);
    for (const row of chart) {
      assert.equal(row.length, 18);
      for (const v of row) assert.ok([0, 0.5, 1, 2].includes(v), `不正な倍率値: ${v}`);
    }
  });

  test("相性表の代表値がver1と一致する（ノーマル→ゴースト0倍、ほのお→くさ2倍など）", () => {
    assert.equal(chart[id("ノーマル")][id("ゴースト")], 0);
    assert.equal(chart[id("ほのお")][id("くさ")], 2);
    assert.equal(chart[id("でんき")][id("じめん")], 0);
    assert.equal(chart[id("あく")][id("はがね")], 1);   // 第6世代以降の等倍
    assert.equal(chart[id("ゴースト")][id("はがね")], 1); // 第6世代以降の等倍
    assert.equal(chart[id("フェアリー")][id("ドラゴン")], 2);
  });
});

describe("U2: abilities.json の整合性", () => {
  test("特性IDは一意で、先頭は「特性なし」", () => {
    const ids = abilities.map((a) => a.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.equal(abilities[0].id, "none");
    assert.equal(abilities[0].rules.length, 0);
  });

  test("全ルールのkindが既知種別で、attackTypesは0〜17の範囲", () => {
    const knownKinds = ["immune", "scale", "scaleIfSuper", "wonderGuard"];
    for (const a of abilities) {
      for (const rule of a.rules) {
        assert.ok(knownKinds.includes(rule.kind), `${a.name}: 未知のkind ${rule.kind}`);
        if (rule.attackTypes) {
          for (const t of rule.attackTypes) assert.ok(t >= 0 && t <= 17);
        }
        if (rule.kind === "scale" || rule.kind === "scaleIfSuper") {
          assert.equal(typeof rule.factor, "number");
        }
      }
    }
  });
});

/* ================= U3: 相性計算（特性なし） ================= */

describe("U3: calcMultipliers（タイプ相性のみ）", () => {
  test("単タイプ: ほのお（みず2倍・くさ0.5倍・じめん2倍）", () => {
    const m = multipliersOf(["ほのお"]);
    assert.equal(m[id("みず")], 2);
    assert.equal(m[id("くさ")], 0.5);
    assert.equal(m[id("じめん")], 2);
    assert.equal(m[id("ノーマル")], 1);
  });

  test("複合タイプ: みず＋じめん（くさ4倍・でんき0倍）", () => {
    const m = multipliersOf(["みず", "じめん"]);
    assert.equal(m[id("くさ")], 4);
    assert.equal(m[id("でんき")], 0);
    assert.equal(m[id("こおり")], 1);   // 0.5 × 2
    assert.equal(m[id("ほのお")], 0.5);
  });

  test("複合タイプ: あく＋ゴースト（かくとう・ノーマル0倍、フェアリー2倍）", () => {
    const m = multipliersOf(["あく", "ゴースト"]);
    assert.equal(m[id("かくとう")], 0);
    assert.equal(m[id("フェアリー")], 2); // 2 × 1
    assert.equal(m[id("ノーマル")], 0);
  });

  test("0.25倍: くさ＋ドラゴンに対するくさ・みず", () => {
    const m = multipliersOf(["くさ", "ドラゴン"]);
    assert.equal(m[id("くさ")], 0.25);
    assert.equal(m[id("みず")], 0.25);
  });
});

/* ================= U4: 特性補正（追加設計書 A1〜A8相当） ================= */

describe("U4: applyAbility（特性補正）", () => {
  test("A1: ひこう＋ふゆう → じめん0倍のまま", () => {
    assert.equal(multipliersOf(["ひこう"], "ふゆう")[id("じめん")], 0);
  });

  test("A2: いわ＋ふゆう → じめん2倍が0倍（無効化がタイプ相性に優先）", () => {
    assert.equal(multipliersOf(["いわ"], "ふゆう")[id("じめん")], 0);
  });

  test("A3: こおり＋あついしぼう → ほのお1倍・こおり0.25倍", () => {
    const m = multipliersOf(["こおり"], "あついしぼう");
    assert.equal(m[id("ほのお")], 1);
    assert.equal(m[id("こおり")], 0.25);
  });

  test("A4: くさ＋はがね＋あついしぼう → ほのお2倍", () => {
    assert.equal(multipliersOf(["くさ", "はがね"], "あついしぼう")[id("ほのお")], 2);
  });

  test("A5: みず＋かんそうはだ → みず0倍・ほのお0.625倍", () => {
    const m = multipliersOf(["みず"], "かんそうはだ");
    assert.equal(m[id("みず")], 0);
    assert.equal(m[id("ほのお")], 0.625);
  });

  test("A6: いわ＋こおり＋フィルター → 4倍が3倍・2倍が1.5倍、等倍以下は不変", () => {
    const m = multipliersOf(["いわ", "こおり"], "フィルター");
    assert.equal(m[id("かくとう")], 3);
    assert.equal(m[id("はがね")], 3);
    assert.equal(m[id("じめん")], 1.5);
    assert.equal(m[id("みず")], 1.5);
    assert.equal(m[id("ノーマル")], 0.5);
    assert.equal(m[id("どく")], 0.5);
  });

  test("A7: むし＋ゴースト＋ふしぎなまもり → 効果ばつぐんの5タイプ以外は0倍", () => {
    const m = multipliersOf(["むし", "ゴースト"], "ふしぎなまもり");
    const survivors = ["ほのお", "ひこう", "いわ", "ゴースト", "あく"];
    for (const t of types) {
      if (survivors.includes(t.name)) {
        assert.equal(m[t.id], 2, `${t.name}は2倍のはず`);
      } else {
        assert.equal(m[t.id], 0, `${t.name}は無効のはず`);
      }
    }
  });

  test("A8: くさ＋むし＋もふもふ → ほのお8倍", () => {
    assert.equal(multipliersOf(["くさ", "むし"], "もふもふ")[id("ほのお")], 8);
  });

  test("特性なしは補正しない（入力配列も変更しない）", () => {
    const base = calcMultipliers(chart, [id("みず")]);
    const snapshot = [...base];
    const m = applyAbility(base, ability("特性なし"));
    assert.deepEqual(m, snapshot);
    assert.deepEqual(base, snapshot);
  });
});

/* ================= U5: グルーピング ================= */

describe("U5: groupByMultiplier（動的グルーピング）", () => {
  test("倍率値の降順にグループ化され、全18タイプを網羅する", () => {
    const m = multipliersOf(["みず", "じめん"]);
    const groups = groupByMultiplier(types, m);
    const values = [...groups.keys()];
    assert.deepEqual(values, [...values].sort((a, b) => b - a));
    const total = [...groups.values()].reduce((acc, ids) => acc + ids.length, 0);
    assert.equal(total, 18);
  });

  test("みず＋じめん: 4倍グループはくさのみ、0倍グループはでんきのみ", () => {
    const groups = groupByMultiplier(types, multipliersOf(["みず", "じめん"]));
    assert.deepEqual(groups.get(4), [id("くさ")]);
    assert.deepEqual(groups.get(0), [id("でんき")]);
  });
});

/* ================= U6: 表示整形 ================= */

describe("U6: formatMultiplier / groupLabel / groupColor", () => {
  test("formatMultiplier: 末尾ゼロなしの表記、0は「無効」", () => {
    assert.equal(formatMultiplier(4), "4倍");
    assert.equal(formatMultiplier(0.75), "0.75倍");
    assert.equal(formatMultiplier(0.125), "0.125倍");
    assert.equal(formatMultiplier(0), "無効");
  });

  test("groupLabel: カテゴリ語の境界（1倍は等倍、1.5倍はばつぐん、0.5倍はいまひとつ）", () => {
    assert.equal(groupLabel(0), "無効（こうかなし）");
    assert.equal(groupLabel(0.5), "0.5倍（いまひとつ）");
    assert.equal(groupLabel(1), "1倍（等倍）");
    assert.equal(groupLabel(1.5), "1.5倍（こうかばつぐん）");
    assert.equal(groupLabel(8), "8倍（こうかばつぐん）");
  });

  test("groupColor: 倍率範囲ごとのアクセント色", () => {
    assert.equal(groupColor(8), "#D32F2F");
    assert.equal(groupColor(4), "#D32F2F");
    assert.equal(groupColor(2), "#F06292");
    assert.equal(groupColor(1), "#9E9E9E");
    assert.equal(groupColor(0.5), "#64B5F6");
    assert.equal(groupColor(0.25), "#1976D2");
    assert.equal(groupColor(0), "#424242");
  });
});
