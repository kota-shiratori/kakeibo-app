# "type": "module" と ESM

## 概要

JavaScript には 2 種類のモジュール方式があります。

| 方式 | 書き方 | 由来 |
| --- | --- | --- |
| **CommonJS (CJS)** | `const x = require("x")` / `module.exports = ...` | Node.js 独自の古い方式 |
| **ES Modules (ESM)** | `import x from "x"` / `export default ...` | JavaScript の標準仕様。ブラウザも対応 |

Node.js は、`package.json` の `"type"` フィールドで `.js` ファイルをどちらとして扱うかを決めます。

- `"type": "module"` → `.js` は **ESM**
- `"type"` 省略 or `"commonjs"` → `.js` は **CJS**
- 拡張子 `.mjs` は常に ESM、`.cjs` は常に CJS

このプロジェクトは backend・web-app ともに `"type": "module"` で、**全面的に ESM** です。

## このプロジェクトでの実装

```json
// backend/package.json:3
"type": "module",
// web-app/package.json:5
"type": "module",
```

### backend: 相対 import に `.js` が付いている理由

```ts
// backend/src/index.ts:1-5
import { Hono } from "hono";
import { cors } from "hono/cors";
import { attachDatabasePool } from "@vercel/functions";
import { Pool } from "pg";
import { env } from "./env.js";
```

```ts
// backend/src/dev.ts:2-4
import "dotenv/config";
import { serve } from "@hono/node-server";
import app from "./index.js";
```

実体は `src/env.ts` / `src/index.ts` なのに `./env.js` / `./index.js` と書いています。これは

1. TypeScript を JS に変換すると `env.js` / `index.js` という名前のファイルになり、
2. 変換後の JS を Node.js の ESM として動かすとき、**Node.js の ESM は拡張子の省略を許さない**

ためです（現在は `tsc` で `dist/` を出力する運用はしていませんが、Vercel Functions も最終的に JS を Node.js で実行するので、ルールは同じです）。TypeScript は「ビルド後の名前（`.js`）」で書くことを要求し、`backend/tsconfig.json:4` の `"module": "NodeNext"` がこのルールを型チェックで強制します（オプションの詳細は study/TypeScript を参照）。開発時の `tsx` も `./env.js` を `./env.ts` に読み替えて実行してくれます。

### web-app: 拡張子なしで書ける理由

```ts
// web-app/src/main.tsx:3
import App from "./App";
```

web-app のコードは Node.js ではなく **Vite（バンドラ）** が解決するため、拡張子省略が許されます。`web-app/tsconfig.app.json:15` の `"moduleResolution": "bundler"` はこの「バンドラ流の解決ルール」を TypeScript に伝える設定です。

### vite.config.ts も ESM

```ts
// web-app/vite.config.ts:1-2
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
```

`"type": "module"` なので、設定ファイルも `import` / `export default` で書きます。

## 重要語句

- **ESM (ECMAScript Modules)**: `import` / `export` による標準モジュール方式。静的解析しやすく、ツリーシェイキング（未使用コードの削除）が効く。
- **CommonJS**: `require` / `module.exports` による Node.js の旧来方式。
- **`"type"` フィールド**: `.js` の解釈を決める package.json の設定。
- **拡張子の明示**: Node.js の ESM では相対パス import に拡張子が必須。

## 仕様・注意点

- ESM では CJS にあった `__dirname` / `__filename` / `require` がそのままでは使えません。代わりに `import.meta.dirname`（Node.js 20.11+ / 21.2+）や `import.meta.url` を使います。
- ESM から CJS パッケージを `import` することは基本的に可能ですが、逆（CJS から ESM を `require`）は Node.js のバージョンによって制約があります。
- backend で `./env` のように拡張子を省くと、`tsx` では動いてしまうことがあっても、`npm run typecheck`（`tsc --noEmit`）が `NodeNext` 設定でエラーにし、変換後の JS を Node.js で実行したときにも失敗します。**「開発では動くのに本番で動かない」典型例**なので注意。

## 今後に活かせるポイント

- 新規プロジェクトは基本的に `"type": "module"` で始めるのが現在の主流。
- 「Node.js が直接実行するコード」と「バンドラが処理するコード」で import の書き方のルールが違う、という区別を意識すると混乱しにくい。

## 改善するなら

- 現状で問題はありません。backend の import は `.js` 付きで統一されており正しい書き方です。
- 将来ファイルが増えたら、拡張子の付け忘れを lint で検出する（例: oxlint の `import` プラグインを有効にして `import/extensions` 系ルールを検討する）と安心です。

## 次に学ぶこと

- `exports` フィールドによる「条件付きエクスポート」（パッケージが ESM/CJS 両対応するしくみ）
- Node.js の `--experimental-strip-types` / 型ストリップ機能（Node 単体で TS を実行する流れ）
- Dynamic import（`await import("...")`）とコード分割
