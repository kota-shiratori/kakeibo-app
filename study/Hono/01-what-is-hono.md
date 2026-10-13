# Hono とは何か

## 概要

Hono（日本語の「炎」が由来）は、**Web 標準 API（`Request` / `Response` / `fetch`）の上に作られた軽量な Web フレームワーク**です。Express のように「URL とメソッドに応じて処理を振り分ける」ためのものですが、次の点が大きく違います。

- Node.js 専用の `req` / `res` オブジェクトではなく、ブラウザにもある **`Request` を受け取って `Response` を返す** という形で書く
- そのため Cloudflare Workers / Deno / Bun / Node.js / AWS Lambda など、**複数のランタイムで同じアプリのコードが動く**
- TypeScript 前提の設計で、ルートやレスポンスの型推論が強い（後述の RPC 機能につながる）
- 依存が少なく、ルーターが高速

家計簿アプリの backend は、この Hono を Node.js 上で動かしています。Node.js で動かすための「つなぎ役」が `@hono/node-server` です。

## このプロジェクトでの実装

`backend/src/index.ts:1-6`

```ts
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { env } from "./env.js";

const app = new Hono();
```

| 行 | 役割 |
| --- | --- |
| 1 | Node.js の HTTP サーバーと Hono をつなぐ `serve` 関数（→ 12 章） |
| 2 | Hono 本体のクラス（→ 02 章） |
| 3 | Hono 組み込みの CORS ミドルウェア（→ 09 章） |
| 4 | 環境変数（`FRONTEND_URL`）の読み込み。詳細は `study/API-Design` 参照 |
| 6 | アプリケーション本体となる Hono インスタンスを作成 |

`backend/package.json` での依存バージョン（インストール済み実体で確認）:

- `hono`: 4.13.13
- `@hono/node-server`: 2.1.4

ファイル全体の流れは次の 4 ステップだけです。

1. `new Hono()` でアプリを作る（6 行目）
2. `app.use` でミドルウェア（CORS）を登録（8-16 行目）
3. `app.get` / `app.post` でルートとハンドラを登録（18-84 行目）
4. `serve` で Node.js の HTTP サーバーを起動し、`app.fetch` に処理を任せる（86-94 行目）

## 重要語句

| 用語 | 意味 |
| --- | --- |
| Web 標準 API | ブラウザ・各種 JS ランタイムで共通に使える API。`Request`, `Response`, `Headers`, `URL`, `fetch` など |
| ランタイム | JavaScript を実行する環境。Node.js, Deno, Bun, Cloudflare Workers など |
| アダプター | Hono をそのランタイムの HTTP サーバーにつなぐ部品。Node.js 用が `@hono/node-server` |
| ハンドラ | 1 つのルートに対する処理関数。`(c) => Response` の形 |
| ミドルウェア | ハンドラの前後に共通処理を挟む関数。`(c, next) => ...` の形 |

## 仕様・注意点

- `hono` パッケージ自体の `engines` は `node >= 16.9.0` ですが、`@hono/node-server` 2.x は **`node >= 20`** を要求します（`node_modules/@hono/node-server/package.json` の `engines`、README の Requirements で確認）。
- Hono 本体はランタイム非依存ですが、このプロジェクトは `dotenv` や `process.env`（`backend/src/env.ts`）など **Node.js 依存のコードも含む** ため、そのまま Workers に持っていけるわけではありません（→ 13 章）。
- インポートパスは機能ごとに分かれています（`hono`, `hono/cors`, `hono/jsx` など）。使わない機能はバンドルに含まれにくい設計です。

## 今後に活かせるポイント

- 「Web 標準の `Request` → `Response` 関数」という考え方を身につけると、Hono 以外（Next.js の Route Handlers、Remix/React Router の loader/action、Service Worker など）でも同じ発想で書けます。
- サーバー起動部分（アダプター）とアプリ本体（`app`）を分けて考えると、ランタイムの乗り換えやテストが楽になります。

## 改善するなら

現状は 1 ファイルにアプリ定義とサーバー起動が同居しています。アプリ定義を別ファイルに切り出すと、テスト（`app.request`）や他ランタイムへの移植がしやすくなります。

```ts
// src/app.ts
import { Hono } from "hono";
export const app = new Hono();
// ... app.use / app.get / app.post

// src/index.ts（Node.js 用の起動だけ）
import { serve } from "@hono/node-server";
import { app } from "./app.js";
serve({ fetch: app.fetch, port: 3000 });
```

## 次に学ぶこと

- 公式ドキュメント: https://hono.dev/docs/
- `create-hono` によるテンプレート作成（ランタイムごとの雛形が選べる）
- 次章からは、ルーティング → Context → ミドルウェア → サーバー起動の順で個別に見ていきます。
