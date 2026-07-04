/*
作成日: 2026-07-04
処理名称: ポケモンタイプ相性チェッカー ロジック層
処理概要: タイプ相性倍率の計算・特性補正・倍率別グルーピング・表示用整形を行う
          純粋関数群。DOMに依存せず、データ（相性表・タイプ定義）は引数で受け取る。
ファイル名: logic.js
*/

// 相性倍率計算（F-02）: 戻り値は攻撃タイプID順の倍率配列
export function calcMultipliers(chart, defenseTypeIds) {
  return chart.map((row) =>
    defenseTypeIds.reduce((acc, def) => acc * row[def], 1)
  );
}

// 特性補正適用（F-07）: 計算順序は追加設計書（特性の考慮）4.1に準拠
export function applyAbility(baseMultipliers, ability) {
  return baseMultipliers.map((base, atk) => {
    let m = base;
    for (const rule of ability.rules) {
      if (rule.kind === "immune" && rule.attackTypes.includes(atk)) return 0;
    }
    for (const rule of ability.rules) {
      if (rule.kind === "scale" && rule.attackTypes.includes(atk)) m *= rule.factor;
    }
    for (const rule of ability.rules) {
      if (rule.kind === "scaleIfSuper" && m > 1) m *= rule.factor;
    }
    for (const rule of ability.rules) {
      if (rule.kind === "wonderGuard" && base <= 1) return 0;
    }
    return m;
  });
}

// 倍率別グルーピング（F-03）: 実際に発生した倍率値の降順で動的にグループ化
export function groupByMultiplier(types, multipliers) {
  const groups = new Map();
  const values = [...new Set(multipliers)].sort((a, b) => b - a);
  for (const value of values) {
    groups.set(value, types.filter((t) => multipliers[t.id] === value).map((t) => t.id));
  }
  return groups;
}

// 倍率表記（末尾ゼロなし。0は「無効」）
export function formatMultiplier(value) {
  return value === 0 ? "無効" : `${value}倍`;
}

// 倍率セクションの見出し
export function groupLabel(value) {
  if (value === 0) return "無効（こうかなし）";
  if (value > 1) return `${formatMultiplier(value)}（こうかばつぐん）`;
  if (value === 1) return "1倍（等倍）";
  return `${formatMultiplier(value)}（いまひとつ）`;
}

// 倍率セクションのアクセント色
export function groupColor(value) {
  if (value >= 4) return "#D32F2F";
  if (value > 1) return "#F06292";
  if (value === 1) return "#9E9E9E";
  if (value >= 0.5) return "#64B5F6";
  if (value > 0) return "#1976D2";
  return "#424242";
}
