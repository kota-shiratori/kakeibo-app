# oxlint の基本（Rust 製 Linter と ESLint との違い）

## 概要

**Linter（リンター）** は、コードを実行せずに読んで「バグの可能性が高い書き方」「ルール違反」を指摘するツールです。型チェック（tsc）が「型の整合性」を見るのに対し、Linter は「書き方・使い方」を見ます。

**oxlint** は **Oxc**（The Oxidation Compiler）プロジェクトの Linter で、**Rust で書かれている**ため非常に高速です。README（`web-app/node_modules/oxlint/README.md`）には「設定なしで、数ミリ秒で完了する」と書かれています。

| | ESLint | oxlint |
| --- | --- | --- |
| 実装言語 | JavaScript | Rust |
| 速度 | 標準 | 数十倍速いとされる |
| 設定ファイル | `eslint.config.js`（flat config） | `.oxlintrc.json`（ESLint v8 形式に近い JSON） |
| プラグイン | npm で個別に追加（`eslint-plugin-react` など） | **主要プラグインのルールを本体に内蔵**（react, typescript, import, jsx-a11y, jest, vitest など） |
| 型情報を使うルール | `typescript-eslint` で対応 | `oxlint-tsgolint` を入れて `typeAware` を有効化 |
| 実績・エコシステム | 非常に豊富 | 急成長中。ESLint の全ルールを網羅しているわけではない |

Vite の React テンプレート（`npm create vite`）は以前 ESLint を採用していましたが、このプロジェクトのテンプレート（`web-app/README.md:3`「some Oxlint rules」）は oxlint 版になっています。

## このプロジェクトでの実装

### スクリプトと依存

```json
// web-app/package.json:10
"lint": "oxlint",
// web-app/package.json:26
"oxlint": "^1.81.0",
```

インストール済みは **oxlint 1.86.0**。`npm run lint` で、カレントディレクトリ（`web-app/`）以下を検査します。`node_modules` や `.gitignore` に書かれたファイル（`dist` など）は除外されます。実際に `npx oxlint --debug=files` で対象ファイルを表示すると、`src/` 以下の 10 ファイルと `vite.config.ts` の計 11 ファイルだけで、`dist/` は含まれていませんでした。

### 設定ファイル

```jsonc
// web-app/.oxlintrc.json:1-8
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

| キー | 意味 |
| --- | --- |
| `$schema` | JSON スキーマ。エディタで設定の補完・検証が効く |
| `plugins` | 有効にする内蔵プラグイン |
| `rules` | 個別ルールの重大度（`"off"` / `"warn"` / `"error"`）とオプション |

### `plugins` の注意点：デフォルトを「上書き」する

`configuration_schema.json` の `plugins` の説明には次のように書かれています。

> NOTE: Setting the `plugins` field will overwrite the base set of plugins.
> The `plugins` array should reflect all of the plugins you want to use.

`npx oxlint --help` によると、デフォルトで有効なのは **unicorn・typescript・oxc** の 3 つで、**react はデフォルトで無効**です。このプロジェクトは `["react", "typescript", "oxc"]` と書いているので、

- react … **追加で有効**
- typescript, oxc … 引き続き有効
- unicorn … **書いていないので無効**になる

という状態です。

### カテゴリと実際に有効なルール

oxlint のルールは `correctness`（明らかに誤り）・`suspicious`・`pedantic`・`perf`・`style`・`restriction`・`nursery` のカテゴリに分かれており、**デフォルトでは `correctness` だけが有効（warn）**です（`npx oxlint --help` の説明より）。

`npx oxlint --print-config` で実際に適用される設定を確認すると、約 130 個のルールが列挙され、たとえば次のものが含まれます。

- `no-debugger`, `no-unused-vars`, `no-unreachable` など（ESLint の基本ルール相当）
- `react/jsx-key`, `react/exhaustive-deps`, `react/set-state-in-effect` など
- `react/rules-of-hooks` は `"deny"`（= `"error"`。設定ファイルで上書きしたため）

### 実行結果

この環境で `npm run lint` 相当（`npx oxlint`）を実行すると、約 0.2 秒で完了し、次の warning が 2 件出ました（終了コードは 0）。

```
src/hooks/useExpenseTransactions.ts:31:5: warning react(set-state-in-effect): Calling setState synchronously within an effect can trigger cascading renders
src/hooks/useIncomeTransactions.ts:31:5: warning react(set-state-in-effect): ...
```

`useEffect` の中で同期的に `setState` を呼んでいる箇所への指摘です（修正方法の議論は study/React 担当）。

## 重要語句

- **Linter**: 静的解析でコードの問題を指摘するツール。
- **oxlint**: Oxc プロジェクトの Rust 製 Linter。
- **Oxc**: Rust 製 JS/TS ツールチェーン（パーサ、変換、Linter、フォーマッタ、リゾルバ）。Vite 8 や plugin-react 6 も内部で Oxc を利用している。
- **ルールの重大度**: `off`（無効）/ `warn`（警告。終了コード 0）/ `error`（エラー。終了コード 1）。oxlint の設定出力では `error` が `deny` と表示される。
- **カテゴリ**: ルールを性質でまとめたグループ。`categories` キーでまとめて有効化できる。
- **type-aware lint**: 型情報を使うルール（例: `typescript/no-floating-promises`）。

## 仕様・注意点

- **oxlint は型チェッカーではありません。** 型エラーは tsc、書き方の問題は oxlint、と役割が違います。両方を CI で走らせるのが理想です。
- `--print-config` には `typescript/no-floating-promises` などの型情報が必要なルールも表示されますが、これらは **type-aware モードを有効にしないと実際には動きません**。`web-app/README.md:16-30` にあるように、`oxlint-tsgolint` をインストールし `"options": { "typeAware": true }` を設定する必要があります。
- **warning だけでは CI が落ちません**（終了コード 0）。warning を許さない運用にするなら `oxlint --deny-warnings` や `--max-warnings=0` を使います。
- `--fix` で自動修正できるルールもあります（`npx oxlint --help` の「Fix Problems」）。
- **backend には Linter がありません。**
- 設定ファイルにはコメントが書けます（`--help` に「you can use comments in configuration files」）。

## 今後に活かせるポイント

- oxlint は設定ゼロでも `npx oxlint` で使えるので、既存プロジェクトに「まず入れてみる」のが簡単。
- ESLint から移行する場合、公式の移行ガイド（https://oxc.rs/docs/guide/usage/linter/migrate-from-eslint.html）や `@oxlint/migrate` が使える。ESLint と併用して、oxlint で対応できないルールだけ ESLint に任せる構成もある。

## 改善するなら

1. **カテゴリを広げて検出力を上げる**。
   ```jsonc
   {
     "$schema": "./node_modules/oxlint/configuration_schema.json",
     "plugins": ["react", "typescript", "oxc", "unicorn", "import", "jsx-a11y"],
     "categories": { "correctness": "error", "suspicious": "warn" },
     "rules": {
       "react/rules-of-hooks": "error",
       "react/only-export-components": ["warn", { "allowConstantExport": true }]
     }
   }
   ```
   `jsx-a11y` を入れるとアクセシビリティの問題（`alt` のない `<img>` など）も検出できる。
2. **type-aware lint を有効にする**（README の推奨。`npm install -D oxlint-tsgolint`）。`fetch` の Promise を `await` し忘れる、といったミスを検出できる。
3. **backend にも oxlint を導入**する。
   ```sh
   cd backend && npm install -D oxlint
   ```
   ```json
   "lint": "oxlint"
   ```
4. CI 用に `"lint": "oxlint --deny-warnings"` にする（まず既存の warning 2 件を解消してから）。

## 次に学ぶこと

- フォーマッタ: Prettier / oxfmt（Oxc のフォーマッタ）/ Biome（Linter とフォーマッタを 1 つで提供する Rust 製ツール）
- Husky + lint-staged：コミット時に変更ファイルだけ lint
- GitHub Actions で `oxlint --format=github` を使い、PR 上に指摘を表示する
