# Hono とは何か

## 概要

Hono（日本語の「炎」が由来）は、**Web 標準 API（`Request` / `Response` / `fetch`）の上に作られた軽量な Web フレームワーク**です。Express のように「URL とメソッドに応じて処理を振り分ける」ためのものですが、次の点が大きく違います。

- Node.js 専用の `req` / `res` オブジェクトではなく、ブラウザにもある **`Request` を受け取って `Response` を返す** という形で書く
- そのため Cloudflare Workers / Deno / Bun / Node.js / AWS Lambda など、**複数のランタイムで同じアプリのコードが動く**
- TypeScript 前提の設計で、ルートやレスポンスの型推論が強い（後述の RPC 機能につながる）
- 依存が少なく、ルーターが高速

家計簿アプリの backend は、この Hono を次の 2 通りで動かしています。

- **ローカル開発**: Node.js 上で動かす。Node.js の HTTP サーバーとの「つなぎ役」が `@hono/node-server`（`backend/src/dev.ts`）
- **本番**: Vercel Functions。`backend/src/index.ts` が `export default app` した Hono アプリを Vercel がそのまま使う（`backend/src/dev.ts:1` のコメント）

## このプロジェクトでの実装

`backend/src/index.ts:1-10`

```ts
import { Hono } from "hono";
import { cors } from "hono/cors";
import { attachDatabasePool } from "@vercel/functions";
import { Pool } from "pg";
import { env } from "./env.js";

const pool = new Pool({ connectionString: env.DATABASE_URL });
attachDatabasePool(pool);

const app = new Hono();
```

| 行 | 役割 |
| --- | --- |
| 1 | Hono 本体のクラス（→ 02 章） |
| 2 | Hono 組み込みの CORS ミドルウェア（→ 09 章） |
| 3 | Vercel Functions 上で DB のアイドル接続を管理する関数（`../PostgreSQL/08-neon-and-vercel-attach-database-pool.md`） |
| 4 | PostgreSQL のドライバ `pg` のコネクションプール（`../PostgreSQL/06-node-postgres-pool-and-query.md`） |
| 5 | 環境変数（`FRONTEND_URL` / `DATABASE_URL`）の読み込み。詳細は `study/API-Design` 参照 |
| 7-8 | DB 接続用の Pool を作成（Hono とは独立した部分） |
| 10 | アプリケーション本体となる Hono インスタンスを作成 |

ローカル起動用のエントリ `backend/src/dev.ts:1-8`

```ts
// ローカル開発用のエントリ。Vercel では src/index.ts の app が直接使われる
import "dotenv/config";
import { serve } from "@hono/node-server";
import app from "./index.js";

serve({ fetch: app.fetch, port: 3000 }, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`);
});
```

`backend/package.json` での依存バージョン（インストール済み実体で確認）:

- `hono`: 4.13.13
- `@hono/node-server`: 2.1.4

全体の流れは次の 4 ステップです。

1. `new Hono()` でアプリを作る（`index.ts:10`）
2. `app.use` でミドルウェア（CORS）を登録（`index.ts:12-20`）
3. `app.get` / `app.post` でルートとハンドラを登録（`index.ts:29-106`。ハンドラの中で `pool.query` により SQL を実行）
4. `export default app`（`index.ts:108`）でアプリを公開する
   - ローカル: `dev.ts` が `serve` で Node.js の HTTP サーバーを起動し、`app.fetch` に処理を任せる（→ 12 章）
   - 本番: Vercel が `export default` された app をリクエストの処理に使う（→ 13 章）

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
- Hono 本体はランタイム非依存ですが、このプロジェクトは `process.env`（`backend/src/env.ts`）や TCP で DB に接続する `pg`、`dotenv`（`dev.ts`）など **Node.js 依存のコードも含む** ため、そのまま Workers に持っていけるわけではありません（→ 13 章）。
- インポートパスは機能ごとに分かれています（`hono`, `hono/cors`, `hono/jsx` など）。使わない機能はバンドルに含まれにくい設計です。

## 今後に活かせるポイント

- 「Web 標準の `Request` → `Response` 関数」という考え方を身につけると、Hono 以外（Next.js の Route Handlers、Remix/React Router の loader/action、Service Worker など）でも同じ発想で書けます。
- サーバー起動部分（アダプター）とアプリ本体（`app`）を分けて考えると、ランタイムの乗り換えやテストが楽になります。

## 改善するなら

「アプリ定義（`index.ts`）」と「Node.js でのサーバー起動（`dev.ts`）」は、すでに別ファイルに分かれています（コミット `2a1609f`）。これにより、同じ `app` をローカルでは `serve` で、本番では Vercel で動かせるようになりました。

残っている課題は、**`index.ts` を読み込むだけで `DATABASE_URL` の検証と `Pool` の作成が走る** ことです。アプリ定義を「DB アクセスの部品を受け取って app を作る関数」にすると、DB なしのテスト（`app.request`）や他ランタイムへの移植がさらにしやすくなります（→ 15 章、`../Architecture/15-persistence-and-repository-layer.md`）。

```ts
// src/app.ts（案）
import { Hono } from "hono";
export const createApp = (repo: TransactionRepository) => {
  const app = new Hono();
  // ... app.use / app.get / app.post（repo を使う）
  return app;
};

// src/index.ts（Vercel 用のエントリ）
const pool = new Pool({ connectionString: env.DATABASE_URL });
export default createApp(createPgTransactionRepository(pool));
```

## 次に学ぶこと

- 公式ドキュメント: https://hono.dev/docs/
- `create-hono` によるテンプレート作成（ランタイムごとの雛形が選べる）
- 次章からは、ルーティング → Context → ミドルウェア → サーバー起動の順で個別に見ていきます。
