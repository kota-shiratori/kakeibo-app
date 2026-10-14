# skipLibCheck・types・lib（型定義ファイルの読み込みを制御する）

## 概要

TypeScript は、自分が書いたコード以外にも多くの **型定義ファイル（`.d.ts`）** を読み込んで型チェックをしています。

- **`lib`**: JavaScript 組み込み API（`Array`, `Promise`, `Object.groupBy`）やブラウザ API（`document`, `fetch`）の型。TypeScript 本体に同梱
- **`types`**: `node_modules/@types/*` などのうち、import しなくても **グローバルに** 読み込む型パッケージ
- **`skipLibCheck`**: 読み込んだ `.d.ts` 自体の中身を型チェックするかどうか

## このプロジェクトでの実装

| 設定 | backend | web-app/tsconfig.app.json | web-app/tsconfig.node.json |
| --- | --- | --- | --- |
| `lib` | 未指定（target ESNext に対応する既定値） | `["ES2023", "DOM"]`（:5） | `["ES2023"]`（:5） |
| `types` | `["node"]`（:7） | `["vite/client"]`（:7） | `["node"]`（:6） |
| `skipLibCheck` | `true` | `true` | `true` |

- **web-app のアプリ本体（`src/`）** はブラウザで動くので `DOM` を含め、Node.js の型は含めない。
- **web-app の `vite.config.ts`** は Node.js 上で動くので `DOM` を含めず、`types: ["node"]` で Node.js の型を読み込む。
- **backend** は Node.js 上で動くので `types: ["node"]`。

このように「実行環境ごとに見える型を分ける」ために tsconfig が分かれています（→ `24-tsconfig-project-references.md`）。

## 各オプションの詳細

### lib

- `"ES2023"` は ES2023 までの組み込み API の型を読み込みます。たとえば ES2024 の `Object.groupBy`（`lib.es2024.object.d.ts` で定義）は、web-app では型エラーになります（`target` が `ESNext` でも、`lib` を明示するとそちらが優先されます）。
- `"DOM"` は `document`、`HTMLElement`、`fetch`、`Response` などの型です。`document.getElementById` が `HTMLElement | null` を返す、という型もここから来ています（`lib.dom.d.ts:13080`）。
- **TypeScript 6.0 では `DOM` に `DOM.Iterable` の内容が統合されました。** `web-app/node_modules/typescript/lib/lib.dom.iterable.d.ts` には「This file's contents are now included in the main types file. The file has been left for backward compatibility.」とあり、以前の Vite テンプレートにあった `"DOM.Iterable"` の指定は不要になっています。
- `lib` を省略すると `target` に応じた既定値になります。backend（`target: ESNext`）では `lib.esnext.full.d.ts` が使われ、これは DOM を含みます（→ `20-tsconfig-backend-overview.md`）。

### types

- `types` を指定すると、**列挙したパッケージだけ** がグローバルに読み込まれます。
- **TypeScript 6.0 で既定値が変わりました。** 以前は省略すると `node_modules/@types` の中身を **すべて** 自動で読み込んでいましたが、6.0 では `types` 省略時は **空配列（何も読み込まない）** です。`_tsc.js:40294` の実装:

  ```js
  function getAutomaticTypeDirectiveNames(options, host) {
    if (!usesWildcardTypes(options)) {
      return options.types ?? [];
    }
    ...
  ```

  以前の挙動にしたい場合は `"types": ["*"]` と書きます。このため、TS 6 以降では `types: ["node"]` のような明示が実質的に必須です。backend が `process.env`（`backend/src/env.ts:9`）を使えるのは、この `types: ["node"]` のおかげです。
- `"vite/client"` は Vite が提供する型で、`import.meta.env`、`import.meta.hot`、`*.module.css` や画像ファイルの import などの型を定義しています（`web-app/node_modules/vite/client.d.ts`）。`import.meta.env.VITE_API_BASE_URL` が型エラーにならないのはこれのおかげです（→ `17-any-propagation.md`）。
- `types` は「import しなくても見えるグローバルな型」の制御です。`import { Hono } from "hono"` のように明示的に import するパッケージの型は、`types` に関係なく読み込まれます。`import { Pool } from "pg"`（`backend/src/index.ts:4`）の型も、`types` に `pg` を書かなくても `@types/pg` から読み込まれます（`npm run typecheck` が通ることで確認）。

### skipLibCheck

- `true` にすると、すべての `.d.ts` ファイル（`node_modules` 内の型定義も、自分で書いた `.d.ts` も）の **内部の型チェックを省略** します。
- 目的: 型チェックの高速化と、ライブラリ同士の型定義の食い違いによるエラーを避けること。ほぼすべてのテンプレートで `true` です。
- `.d.ts` を「使う側」のチェックは行われるので、ライブラリの API を間違って呼べばちゃんとエラーになります。

## 重要語句

| 用語 | 意味 |
| --- | --- |
| 型定義ファイル (.d.ts) | 型情報だけを記述したファイル。実装を含まない |
| @types/xxx | DefinitelyTyped で管理される、型定義だけの npm パッケージ（`@types/node`, `@types/react` など） |
| グローバル型 | import せずにどこからでも参照できる型（`process`, `document` など） |
| triple-slash directive | `/// <reference types="..." />` のように、ファイル単位で型を読み込むコメント |

## 仕様・注意点

- **自分で書いた `.d.ts` のミスも見逃す**: `skipLibCheck: true` だと、`src/vite-env.d.ts` のような自作の `.d.ts` 内の誤りもチェックされません。
- **バージョンの不一致に注意**: backend は `@types/node` ^26（`backend/package.json:18`）、web-app は ^24（`web-app/package.json:22`）です。それぞれの tsconfig が別プロジェクトなので衝突はしませんが、実行する Node.js のバージョンと `@types/node` のメジャーバージョンを揃えるのが基本です。
- `lib` に `DOM` を入れたままにすると、Node.js 環境のコードで `window` などを誤って使っても型エラーになりません。逆に web-app の `src` で `process.env` を使うと（`types` に `node` が無いので）型エラーになり、誤用を防げます。

## 今後に活かせるポイント

- 「実行環境に存在する API の型だけを見せる」のが tsconfig の `lib` / `types` 設計の基本です。
- TS 6 以降で `Cannot find name 'process'` や `Cannot find name 'describe'` が出たら、まず `types` に `node` やテストランナーの型（`vitest/globals` など）を追加し忘れていないか確認します。

## 改善するなら

- backend に `lib` を明示し、DOM 型を除外する（→ `20-tsconfig-backend-overview.md` の改善案）。
- backend と web-app の `@types/node` のバージョンを、実際に使う Node.js のバージョンに合わせて揃える。

## 次に学ぶこと

- `typeRoots` と `types` の関係
- `/// <reference types="vite/client" />` と tsconfig の `types` の違い
- 宣言マージによるグローバル型の拡張（`declare global`）
