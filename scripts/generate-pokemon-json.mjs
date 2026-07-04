/*
作成日: 2026-07-04
処理名称: ポケモンデータ生成スクリプト
処理概要: PokeAPIのGraphQLエンドポイントから全ポケモン種の日本語名（ja-Hrkt）、
          基本フォルム（is_default）のタイプ、および特性（通常＋隠れ）を一括取得し、
          data/pokemon.json を生成する。特性はタイプ相性に影響するもののみ
          abilities.json のIDへ変換し、影響しないものはID 0（特性なし）に集約する。
          新世代のポケモン追加時に再実行して更新する。
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

// PokeAPIの特性名（英語）→ data/abilities.json の配列インデックス。
// ここに載っていない特性はタイプ相性に影響しないため、ID 0（特性なし）に集約する。
const ABILITY_ID = {
  levitate: 1,
  "thick-fat": 2,
  "flash-fire": 3,
  "well-baked-body": 4,
  "water-absorb": 5,
  "storm-drain": 6,
  "volt-absorb": 7,
  "lightning-rod": 8,
  "motor-drive": 9,
  "sap-sipper": 10,
  "dry-skin": 11,
  fluffy: 12,
  filter: 13,
  "solid-rock": 14,
  "prism-armor": 15,
  "wonder-guard": 16,
};

// language_id 1 = ja-Hrkt（日本語・かなカナ表記）
const QUERY = `query {
  species: pokemonspecies(order_by: {id: asc}) {
    id
    names: pokemonspeciesnames(where: {language_id: {_eq: 1}}) { name }
    pokemons(where: {is_default: {_eq: true}}) {
      id
      types: pokemontypes(order_by: {slot: asc}) { type { name } }
      abilities: pokemonabilities(order_by: {slot: asc}) { ability { name } }
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
  // 相性に影響する特性のみIDへ変換し、それ以外は0に集約（重複除去・昇順）
  const rawAbilities = s.pokemons[0]?.abilities ?? [];
  const abilityIds = [...new Set(
    rawAbilities.map((a) => ABILITY_ID[a.ability.name] ?? 0)
  )].sort((a, b) => a - b);

  if (!name) throw new Error(`日本語名が取得できません: 図鑑No ${s.id}`);
  if (!types || types.length < 1 || types.length > 2 || types.some((t) => t === undefined)) {
    throw new Error(`タイプが不正です: 図鑑No ${s.id} (${name})`);
  }
  if (abilityIds.length < 1 || abilityIds.length > 3) {
    throw new Error(`特性が不正です: 図鑑No ${s.id} (${name})`);
  }
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
      "全ポケモン種の日本語名と基本フォルムのタイプ・特性。types はtypes.jsonのタイプID。" +
      "abilityIds はabilities.jsonのインデックス（相性に影響しない特性は0に集約、隠れ特性含む）。" +
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
