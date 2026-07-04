<!--
作成日: 2026-07-04
処理名称: ポケモンタイプ相性検索ツール 追加設計書（Electron移行・UI改善）
処理概要: 単一HTMLファイル版（ver1）をElectronベースのアプリケーション構成へ移行し、
          あわせてダークモード対応・スマートフォン操作性改善を行うための設計を定義する。
ファイル名: pokemon_type_chart_electron_design.md
-->

# ポケモンタイプ相性検索ツール 追加設計書（Electron移行・UI改善）

## 1. 文書情報

| 項目 | 内容 |
|---|---|
| 作成日 | 2026-07-04 |
| 対象仕様書 | pokemon_type_chart_spec.md および本書2章の変更要求 |
| 上位文書 | pokemon_type_chart_basic_design.md / pokemon_type_chart_detailed_design.md / pokemon_type_chart_ability_design.md |
| 版数 | 1.0 |

## 2. 背景・目的（変更要求）

### 2.1 実装方法・技術スタックの変更

- 単一HTMLファイル形式版を **ver1** として履歴を保存したまま、別の実装に変更する。
- **Electron** を利用した JavaScript + HTML + CSS のアプリケーションに変更する。
- タイプ相性・特性の情報をそれぞれ**別ファイル（JSON）**に保存する。

### 2.2 アプリケーション動作仕様の変更

- **ダークモード対応**: ノーマル／ダークを切り替えるボタン（電球アイコン）を画面右上隅に配置。
- **スマホ対応の細部改善**:
  - 防御側タイプの選択が終わったら「選択中のタイプ」エリアへ自動スクロール。
  - 単タイプの場合は同一タイプの2度クリックで「選択中のタイプ」エリアへ自動スクロール。
  - 「選択中のタイプ」エリアの縦幅を抑え、「相性倍率」エリアを見やすくする。
  - 「選択中のタイプ」エリアのクリアボタンを廃止し、「相性倍率」エリアにクリアボタンを配置。
  - クリア押下後は「防御側タイプ選択」エリアへ自動スクロール。

## 3. ver1 の保存方針

| 保存先 | 内容 |
|---|---|
| Gitタグ `v1.0` | 単一HTMLファイル版の最終コミットを指す（恒久保存） |
| ブランチ `ver1` | 同上（ブラウザ上での参照・緊急修正用） |

- `main` は本設計に基づく ver2（Electron版）へ移行する。
- ver1 の全コミット履歴はそのまま `main` の履歴として残る（履歴の書き換えは行わない）。

## 4. 技術スタック・全体構成

### 4.1 技術スタック

| 項目 | 採用技術 | 補足 |
|---|---|---|
| デスクトップランタイム | Electron（最新安定版） | `devDependencies` として導入 |
| UI | HTML + CSS + JavaScript（Vanilla、ESモジュール） | フレームワーク不使用（ver1の方針を踏襲） |
| データ | JSON（`data/` 配下に分離） | タイプ相性と特性を別ファイル化 |
| パッケージ管理 | npm（`package.json`） | `npm start` で起動 |
| 単体テスト | Node.js 標準テストランナー（`node --test`） | 追加依存なし |
| E2E検証 | Playwright（`_electron`）による実起動検証 | 開発時のみ使用 |

### 4.2 ディレクトリ構成

```
pokemon/
├── package.json                 # npm定義（start / test スクリプト）
├── index.html                   # ルートリダイレクト（GitHub Pages用、ver2レンダラーへ転送）
├── .nojekyll
├── data/
│   ├── types.json               # タイプ定義＋18×18タイプ相性表
│   └── abilities.json           # 特性定義（宣言的ルール）
├── src/
│   ├── main/
│   │   ├── main.js              # Electronメインプロセス（ウィンドウ生成・データ提供IPC）
│   │   └── preload.js           # contextBridgeによる安全なAPI公開
│   └── renderer/
│       ├── index.html           # 画面構造
│       ├── style.css            # スタイル（ライト／ダークテーマ変数）
│       ├── app.js               # 表示層・状態管理・イベント処理
│       └── logic.js             # ロジック層（純粋関数のみ、テスト対象）
├── test/
│   └── logic.test.mjs           # 単体テスト（データ検証＋計算ロジック）
└── doc/                         # 設計書一式（既存＋本書）
```

- ver1 の `src/pokemon_type_chart.html` は削除する（タグ `v1.0`・ブランチ `ver1` で参照可能）。

### 4.3 プロセス構成とセキュリティ方針（Electronベストプラクティス）

| 設定 | 値 | 理由 |
|---|---|---|
| `contextIsolation` | `true` | レンダラーとpreloadのコンテキスト分離 |
| `nodeIntegration` | `false` | レンダラーからNode APIを遮断 |
| `sandbox` | `true` | レンダラーをサンドボックス化 |
| データ受け渡し | `ipcMain.handle` / `ipcRenderer.invoke` ＋ `contextBridge` | 最小権限のAPIのみ公開 |

```
[main.js] fsでJSON読込 → ipcMain.handle("get-data")
     ↑ invoke
[preload.js] contextBridge.exposeInMainWorld("pokeApi", { getData })
     ↑ window.pokeApi.getData()
[renderer/app.js] データ受領 → logic.js の純粋関数で計算 → DOM描画
```

### 4.4 ブラウザ互換（GitHub Pages）

レンダラーは Electron 専用APIに直接依存させず、データ取得を抽象化する。

- `window.pokeApi` が存在する場合（Electron）: IPC経由で取得。
- 存在しない場合（ブラウザ/GitHub Pages）: `fetch("../../data/*.json")` で取得。

これにより ver2 も GitHub Pages（`https://sgkz0920.github.io/pokemon-type-chart/`）でそのまま動作し、ルートの `index.html` は `src/renderer/index.html` への転送に更新する。

## 5. データファイル設計

JSONは仕様上コメントを記述できないため、ファイルヘッダコメントの代わりに `_meta` オブジェクトで基本情報を保持する。

### 5.1 `data/types.json`（タイプ定義＋タイプ相性表）

```json
{
  "_meta": { "createdAt": "2026-07-04", "name": "タイプ定義・タイプ相性表", "description": "..." },
  "types": [
    { "id": 0, "name": "ノーマル", "color": "#A8A878", "darkText": false },
    ...
  ],
  "chart": [
    [1, 1, 1, ...],   // chart[攻撃タイプID][防御タイプID] = 倍率
    ...
  ]
}
```

- `types`: 18要素。`id` は配列インデックスと一致（既存設計と同一）。
- `chart`: 18×18。値は 0 / 0.5 / 1 / 2 のいずれか（第6世代以降準拠、ver1と同一値）。

### 5.2 `data/abilities.json`（特性定義）

```json
{
  "_meta": { "createdAt": "2026-07-04", "name": "特性定義", "description": "..." },
  "abilities": [
    { "id": "none", "name": "特性なし", "description": "", "rules": [] },
    { "id": "levitate", "name": "ふゆう", "description": "じめん技を無効化",
      "rules": [{ "kind": "immune", "attackTypes": [8] }] },
    ...
  ]
}
```

- ルール種別（`immune` / `scale` / `scaleIfSuper` / `wonderGuard`）と適用順序は追加設計書（特性の考慮）4.1章のまま変更しない。
- 特性の追加は `abilities.json` への1エントリ追加で完結する（コード変更不要）。

## 6. モジュール設計

### 6.1 `src/renderer/logic.js`（ロジック層・純粋関数）

ver1 のロジック層関数を、データを引数で受け取る形に一般化して移植する。DOMには一切依存しない。

| 関数 | シグネチャ | 変更点 |
|---|---|---|
| `calcMultipliers` | `(chart, defenseTypeIds) => number[]` | `TYPE_CHART` を引数化 |
| `applyAbility` | `(baseMultipliers, ability) => number[]` | 変更なし（移植） |
| `groupByMultiplier` | `(types, multipliers) => Map<number, number[]>` | `TYPES` を引数化 |
| `formatMultiplier` | `(value) => string` | 変更なし（移植） |
| `groupLabel` | `(value) => string` | 変更なし（移植） |
| `groupColor` | `(value) => string` | 変更なし（移植） |

### 6.2 `src/renderer/app.js`（状態管理・表示層）

ver1 の状態管理（`selectedTypes` / `selectedAbilityId`）と単方向データフロー（状態変更→`renderAll()`）を維持し、以下を追加する。

- 状態の追加: `theme`（`"light"` | `"dark"`。`localStorage` に永続化）
- データ読込: 起動時に非同期でデータ取得後、UI構築（4.4章の抽象化）

### 6.3 `src/main/main.js` / `src/main/preload.js`

| ファイル | 責務 |
|---|---|
| `main.js` | `BrowserWindow` 生成（4.3章の設定）、`data/*.json` の読込、`get-data` IPCハンドラ |
| `preload.js` | `window.pokeApi.getData()` の公開のみ（最小API） |

## 7. 画面設計の変更

### 7.1 ダークモード（F-08）

- 画面右上隅に**固定配置**のテーマ切替ボタン（電球アイコン 💡）を置く。
- 全配色をCSSカスタムプロパティ化し、`<html data-theme="dark">` の有無で切り替える。
- タイプのイメージカラー（ボタン・バッジ背景）はテーマによらず不変とする。
- 初期値: `localStorage` に保存値があればそれを優先、なければOS設定（`prefers-color-scheme`）に従う。
- 切替時は `localStorage` に保存し、次回起動時に復元する。

| 部品 | 内容 |
|---|---|
| `#theme-toggle` | button。`position: fixed; top/right` で右上隅に固定。ライト時 💡、ダーク時 🌙 を表示 |

### 7.2 クリアボタンの移設（F-05変更）

- 「選択中のタイプ」エリアのクリアボタンを**廃止**。
- 「相性倍率」エリアの見出し行右端にクリアボタンを配置（従来と同じ活性条件・リセット内容）。

### 7.3 自動スクロール（F-09）

| No | トリガ | スクロール先 |
|---|---|---|
| S1 | 2つ目のタイプを選択（複合タイプ確定） | 「選択中のタイプ」エリア |
| S2 | 選択中タイプが1つのとき、同一タイプを再クリック（単タイプ確定） | 「選択中のタイプ」エリア |
| S3 | クリアボタン押下 | 「防御側タイプ選択」エリア |

- スクロールは `scrollIntoView({ behavior: "smooth" })` で行う。
- **対象エリアが画面内に完全に収まっている場合はスクロールしない**（PC等の大画面では実質無効化され、スマホでのみ体感される）。
- S2 の再クリックは選択状態を変更しない（単タイプの「確定」操作として扱う）。タイプ選択が2つのときに選択中タイプをクリックした場合は、従来どおり解除として扱う。

### 7.4 タイプ選択トグルの挙動変更（F-01変更）

| 操作 | ver1 | ver2 |
|---|---|---|
| 未選択タイプをクリック | 選択（3つ目はFIFOで最古解除） | 同左＋2つ目確定時に自動スクロール（S1） |
| 選択中タイプをクリック（選択数2） | 解除 | 同左 |
| 選択中タイプをクリック（選択数1） | 解除 | **解除しない**。単タイプ確定として自動スクロール（S2） |

- 選択数1からの解除手段はクリアボタン（7.2章）に一本化する。

### 7.5 「選択中のタイプ」エリアのコンパクト化

スマホ（幅600px以下）で「相性倍率」エリアが画面に入りやすいよう、以下を縮小する。

- ステータススロットの `padding`・フォントサイズ・最小幅を縮小。
- セクションの `padding`・マージンを縮小。
- 特性選択行の上マージンを縮小。

## 8. 機能一覧の更新

| 機能ID | 機能名 | 概要 | 状態 |
|---|---|---|---|
| F-01 | タイプ選択機能 | 7.4章の挙動に変更 | 変更 |
| F-05 | 選択クリア機能 | ボタンを「相性倍率」エリアへ移設、押下後スクロール | 変更 |
| F-08 | ダークモード | 右上ボタンでライト／ダーク切替、設定永続化 | 新規 |
| F-09 | 自動スクロール | S1〜S3のスクロール制御 | 新規 |
| F-02/F-03/F-04/F-06/F-07 | 相性計算・表示・特性 | ロジック変更なし（データ外部化のみ） | 維持 |

## 9. テスト計画

### 9.1 単体テスト（`node --test`）

| No | 分類 | 観点 |
|---|---|---|
| U1 | データ検証 | types.json: 18タイプ・id連番・色形式 / chart: 18×18・値が {0, 0.5, 1, 2} |
| U2 | データ検証 | abilities.json: 全ルールの kind が既知種別、attackTypes が 0〜17 |
| U3 | 相性計算 | 単タイプ・複合タイプの倍率（ver1詳細設計の代表ケース） |
| U4 | 特性補正 | 追加設計書（特性の考慮）10章 A1〜A8 の計算ケース |
| U5 | グルーピング | 動的グルーピングの降順・網羅性 |
| U6 | 表記 | formatMultiplier / groupLabel / groupColor の境界値 |

### 9.2 E2E検証（Playwright + Electron実起動）

| No | 観点 | 期待結果 |
|---|---|---|
| E1 | 起動・データ読込 | 18個のタイプボタンと特性セレクトが表示される |
| E2 | 相性計算表示 | みず＋じめん選択で「4倍（こうかばつぐん）: くさ」等が表示される |
| E3 | ダークモード | 切替ボタンで `data-theme` が切り替わり、再起動後も維持される |
| E4 | クリアボタン | 「相性倍率」エリアに配置され、押下でタイプ・特性がリセットされる |
| E5 | 単タイプ確定 | 選択数1で同一タイプ再クリックしても選択が解除されない |

## 10. GitHub反映方針

- ブランチ `feature/electron-migration` 上で実装し、テスト完了後に `main` へマージする。
- タグ `v1.0`・ブランチ `ver1` を同時にpushし、ver1を恒久保存する。
- `node_modules/` は `.gitignore` で除外する。
