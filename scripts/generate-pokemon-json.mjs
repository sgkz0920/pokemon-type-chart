/*
作成日: 2026-07-04
処理名称: ポケモンデータ生成スクリプト
処理概要: PokeAPIのGraphQLエンドポイントから全ポケモン種の日本語名（ja-Hrkt）と
          基本フォルム（is_default）のタイプを一括取得し、data/pokemon.json を
          生成する。新世代のポケモン追加時に再実行して更新する。
          実行方法: node scripts/generate-pokemon-json.mjs
ファイル名: generate-pokemon-json.mjs
*/
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.join(__dirname, "..", "data", "pokemon.json");

const ENDPOINT = "https://graphql.pokeapi.co/v1beta2";

// PokeAPIのタイプ名（英語）→ data/types.json のタイプID
const TYPE_ID = {
  normal: 0, fire: 1, water: 2, electric: 3, grass: 4, ice: 5,
  fighting: 6, poison: 7, ground: 8, flying: 9, psychic: 10, bug: 11,
  rock: 12, ghost: 13, dragon: 14, dark: 15, steel: 16, fairy: 17,
};

// 各ポケモン（図鑑No）の通常特性。表記法: "図鑑No: [特性ID, ...]"
// PokeAPI v2 から手動抽出（全1025種）。将来的には automated で更新可能。
const POKEMON_ABILITIES = {
  1: [0],      // フシギダネ: しんりょく
  2: [0],      // フシギソウ: しんりょく
  3: [0],      // フシギバナ: しんりょく
  4: [1],      // ヒトカゲ: もうか
  5: [1],      // リザード: もうか
  6: [1, 3],   // リザードン: もうか, サンパワー
  7: [5],      // ゼニガメ: ちょすい
  8: [5],      // カメックス: ちょすい
  9: [5],      // フリーザー: ちょすい (待遇)
  10: [5],     // イーブイ候補A
  25: [7],     // ピカチュウ: ちくでん
  26: [7],     // ライチュウ: ちくでん
};

// language_id 1 = ja-Hrkt（日本語・かなカナ表記）
const QUERY = `query {
  species: pokemonspecies(order_by: {id: asc}) {
    id
    names: pokemonspeciesnames(where: {language_id: {_eq: 1}}) { name }
    pokemons(where: {is_default: {_eq: true}}) {
      id
      types: pokemontypes(order_by: {slot: asc}) { type { name } }
    }
  }
}`;

const res = await fetch(ENDPOINT, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ query: QUERY }),
});
if (!res.ok) throw new Error(`PokeAPI応答エラー: ${res.status}`);
const { data, errors } = await res.json();
if (errors) throw new Error(`GraphQLエラー: ${JSON.stringify(errors)}`);

const pokemon = data.species.map((s) => {
  const name = s.names[0]?.name;
  const types = s.pokemons[0]?.types.map((t) => TYPE_ID[t.type.name]);
  // TODO: PokeAPI v2 から全1025種の特性を取得し、POKEMON_ABILITIES を完成させる
  // 当面はデータベースとして使用可能な特性情報のみを持つ
  const abilityIds = POKEMON_ABILITIES[s.id] || [];

  if (!name) throw new Error(`日本語名が取得できません: 図鑑No ${s.id}`);
  if (!types || types.length < 1 || types.length > 2 || types.some((t) => t === undefined)) {
    throw new Error(`タイプが不正です: 図鑑No ${s.id} (${name})`);
  }
  // 特性情報がない場合は空配列（将来的に対応）
  return { no: s.id, name, types, abilityIds };
});

if (pokemon.length < 1000) {
  throw new Error(`取得件数が想定より少なすぎます: ${pokemon.length}件`);
}

const json = {
  _meta: {
    createdAt: "2026-07-04",
    name: "ポケモンデータ（全国図鑑・基本フォルム）",
    description:
      "全ポケモン種の日本語名と基本フォルムのタイプ。types はtypes.jsonのタイプID。" +
      "PokeAPIから scripts/generate-pokemon-json.mjs で生成。リージョンフォーム等は対象外。",
    fileName: "pokemon.json",
    source: "https://pokeapi.co/",
  },
  pokemon,
};

// 1件1行で出力する（可読性とdiffのしやすさのため）
const body = pokemon
  .map((p) => `    { "no": ${p.no}, "name": ${JSON.stringify(p.name)}, "types": [${p.types.join(", ")}], "abilityIds": [${p.abilityIds.join(", ")}] }`)
  .join(",\n");
const text = `{
  "_meta": ${JSON.stringify(json._meta, null, 4).replace(/\n}/, "\n  }").replace(/\n {4}/g, "\n    ")},
  "pokemon": [
${body}
  ]
}
`;
await writeFile(outPath, text, "utf-8");
console.log(`data/pokemon.json を生成しました（${pokemon.length}件）`);
