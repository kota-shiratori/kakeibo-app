# `app.request()` でサーバーを起動せずに動作確認する

## 概要

Hono アプリは「`Request` → `Response` の関数」なので、**ポートを開かなくても** リクエストを投げて結果を確かめられます。そのための便利メソッドが `app.request()` です。テストコードはもちろん、ちょっとした挙動確認にも使えます。

このノートシリーズ（02, 05, 06, 08, 09, 10, 11 章）に書いた挙動の多くは、実際に `app.request()` を使って確認したものです。

## このプロジェクトでの実装

現在の backend にテストコードはありません。

`serve()` は `dev.ts` に分離され、`index.ts` は app を定義して `export default app`（108 行目）するだけになったので、**`app` を import してもサーバーは起動しません**。`app.request()` でテストできる構造に一歩近づきました。

ただし `index.ts` を import すると、モジュールのトップレベルで次の処理が走ります。

- `env.ts` の読み込み → `FRONTEND_URL` と `DATABASE_URL` の検証（`env.ts:4-10`）
- `new Pool({ connectionString: env.DATABASE_URL })` と `attachDatabasePool(pool)`（`index.ts:7-8`）

### 実験：DB なしで `app.request()` するとどうなるか

テスト用のスクリプトから `import app from "backend/src/index.ts"` して確認しました（`tsx` で実行）。

| 条件 | 結果 |
| --- | --- |
| `DATABASE_URL` が未設定 | import の時点で `❌ Invalid environment variables`（`path: [ 'DATABASE_URL' ]`）が出て例外。**1 件もテストできない** |
| `DATABASE_URL` に接続できない URL（`postgresql://u:p@127.0.0.1:1/x`）を設定 | import は成功（`Pool` は作成時には接続しない）。以下のとおり、DB に触る前に return する分岐だけは動く |

DB に接続できない状態での各リクエストの結果:

```text
GET /transactions?type=x            → 400 {"message":"typeはincome,expense,allのいずれかである必要があります。"}
POST /transactions {"item":"a"}     → 400 {"message":"必須項目が不足しています。"}
POST /transactions {bad             → 500 Internal Server Error（不正 JSON。DB とは無関係）
GET /transactions?type=all          → 500 Internal Server Error（connect ECONNREFUSED 127.0.0.1:1）
```

- `attachDatabasePool` は Vercel 以外では実質何もしないので（`release` のリスナーは登録されるが、`VERCEL_URL` / `VERCEL_REGION` がないとすぐ return する）、テストの邪魔にはなりません（`../PostgreSQL/08-neon-and-vercel-attach-database-pool.md`）。
- **400 の分岐（検証）は DB なしでもテストできる** が、**正常系（200 / 201）は本物の DB がないとテストできない**。これが今の構造の限界です。
- このノートの実験では、Docker の `kakeibo-postgres` に使い捨てのデータベースを作り、`transactions` テーブルを用意して正常系も確認しました（`../Docker/`、実験後に削除）。

`app.request` の実装（`node_modules/hono/dist/hono-base.js`）:

```js
request = (input, requestInit, Env, executionCtx) => {
  if (input instanceof Request) return this.fetch(requestInit ? new Request(input, requestInit) : input, Env, executionCtx);
  input = input.toString();
  return this.fetch(
    new Request(/^https?:\/\//.test(input) ? input : `http://localhost${mergePath("/", input)}`, requestInit),
    Env, executionCtx);
};
```

- パスだけ渡すと `http://localhost` が補われる
- 中身は `new Request(...)` を作って `app.fetch` を呼んでいるだけ

## 重要語句

| 用語 | 意味 |
| --- | --- |
| `app.request(pathOrUrlOrRequest, init?, env?, executionCtx?)` | アプリにリクエストを送り `Response`（Promise）を得る |
| `RequestInit` | `fetch` の第 2 引数と同じオプション（`method`, `headers`, `body` など） |
| `testClient`（`hono/testing`） | RPC の型付きクライアントでテストを書くヘルパー |

## 仕様・注意点

- ブラウザではないので、**CORS の制限は適用されません**。CORS ヘッダが付いているかどうかはレスポンスヘッダを見て確認します。
- `body` に文字列を渡し `headers` を指定しない場合、`Request` の仕様により Content-Type は `text/plain;charset=UTF-8` になります。`c.req.json()` は Content-Type を見ないので問題ありませんが、`validator("json")` を使うルートでは `Content-Type: application/json` を明示しないとパースされません（05 章）。
- `env` 引数で `c.env` に入る値を差し込めるので、Workers の Bindings を使うコードもテストできます。

## 今後に活かせるポイント

DB アクセスをリポジトリとして外から渡せる形（`createApp(repo)`。01 章の改善案、`../Architecture/15-persistence-and-repository-layer.md`）にしておけば、テストではメモリ上の実装を渡して、DB なしで正常系まで Vitest などで書けます。

```ts
// src/app.test.ts
import { describe, it, expect } from "vitest";
import { createApp } from "./app.js";
import { createInMemoryTransactionRepository } from "./repositories/transactionRepository.js";

const repo = createInMemoryTransactionRepository();
await repo.create({ item: "給料", amount: 10000, date: "2025-01-01" });
const app = createApp(repo);

describe("GET /transactions", () => {
  it("type が無ければ 400", async () => {
    const res = await app.request("/transactions");
    expect(res.status).toBe(400);
  });

  it("type=all で 200 と一覧", async () => {
    const res = await app.request("/transactions?type=all");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalCount).toBe(1);
  });
});

describe("POST /transactions", () => {
  it("金額 0 は 400", async () => {
    const res = await app.request("/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item: "x", amount: 0, date: "2025-01-01" }),
    });
    expect(res.status).toBe(400);
  });
});
```

## 改善するなら

1. ~~`app` 定義と `serve()` を別ファイルに分ける。~~ → `index.ts` / `dev.ts` の分割で対応済み。
2. DB アクセスをリポジトリ層に分け、`createApp(repo)` の形にする（上の例）。ハンドラのテストから DB を切り離せる。
3. `backend/src/env.ts` は import 時に環境変数を検証するため、テスト時にも `FRONTEND_URL`（今の構造なら `DATABASE_URL` も）が必要になる点に注意（テスト用の値を設定する。詳細は `study/API-Design`）。
4. リポジトリの pg 実装そのもの（SQL が正しいか）は、Docker の PostgreSQL を使った結合テストで別に確認する。
5. 上のテストのように、手書きバリデーションの各分岐（11 章）をテストで固定しておくと、Zod などへの置き換え時に安全にリファクタリングできます。

## 次に学ぶこと

- `testClient`（`hono/testing`）と Hono RPC を使った型安全なテスト
- Vitest のセットアップ（ツール面は `study/Tooling`）
- Cloudflare Workers 向けには `@cloudflare/vitest-pool-workers` を使ったテスト
