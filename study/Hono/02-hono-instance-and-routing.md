# Hono インスタンスとルーティング

## 概要

ルーティングとは「どの HTTP メソッド + どのパス のリクエストを、どの関数で処理するか」を決める仕組みです。Hono では `new Hono()` で作ったインスタンスに対し、`app.get(パス, ハンドラ)` のようにメソッド名の関数でルートを登録します。

## このプロジェクトでの実装

`backend/src/index.ts:6`

```ts
const app = new Hono();
```

`backend/src/index.ts:18`（取引一覧の取得）

```ts
app.get("/transactions", async (c) => {
  // ...
});
```

`backend/src/index.ts:51`（取引の登録）

```ts
app.post("/transactions", async (c) => {
  // ...
});
```

同じパス `/transactions` でも、**メソッドが違えば別ルート** として扱われます。

| メソッド | パス | 用途 | フロント側の呼び出し |
| --- | --- | --- | --- |
| GET | `/transactions` | 一覧取得（`?type=` で絞り込み） | `web-app/src/hooks/useExpenseTransactions.ts:15` など |
| POST | `/transactions` | 新規登録 | `web-app/src/hooks/useAddTransactions.ts:14-18` |

## 重要語句

| 用語 | 意味 |
| --- | --- |
| `new Hono()` | アプリ本体。ルート・ミドルウェア・エラーハンドラなどを保持する |
| `app.get` / `app.post` / `app.put` / `app.delete` / `app.patch` / `app.options` | 各 HTTP メソッド用のルート登録関数 |
| `app.all` | すべてのメソッドにマッチするルートを登録 |
| `app.on(method, path, handler)` | 任意のメソッド（複数可）でルート登録 |
| パスパラメータ | `/transactions/:id` のように `:名前` で可変部分を表す。`c.req.param("id")` で取得 |
| ワイルドカード | `*` で任意の文字列にマッチ（例: `/api/*`） |
| ルーター | パスとハンドラを照合するエンジン。既定は `SmartRouter` |

## 仕様・注意点

- **既定のルーター**: `new Hono()` は `SmartRouter({ routers: [new RegExpRouter(), new TrieRouter()] })` を使います（`node_modules/hono/dist/hono.js` で確認）。登録されたルートに応じて高速な方を自動選択します。`new Hono({ router: ... })` で差し替えも可能です。
- **末尾スラッシュは区別される**: 既定（strict モード）では `/transactions` と `/transactions/` は別物です。実際に `app.request("/transactions/")` を試すと **404** になりました。`new Hono({ strict: false })` にすると同一視されます。
- **HEAD は GET で自動処理**: `HEAD /transactions` を送ると、Hono は内部で GET ハンドラを実行し、ボディを空にして返します（`hono-base.js` の `#dispatch` で確認。実験でも 200・空ボディ）。
- **マッチしないパスは 404**: 既定では `text/plain` の `404 Not Found` が返ります（→ 10 章）。
- **登録順**: 同じリクエストに複数のルート/ミドルウェアがマッチする場合、**登録した順** に実行されます。ミドルウェアはルートより前に登録するのが基本です（→ 08 章）。
- **Hono 4.13 の新メソッド**: このバージョンのメソッド一覧には `get, post, put, delete, options, patch` に加えて `query`（HTTP の QUERY メソッド）が含まれています（`node_modules/hono/dist/router.js` の `METHODS`）。古いバージョンの記事には出てきません。
- メソッドチェーンも可能です: `app.get(...).post(...)`。各登録関数は Hono インスタンス自身を返します。

## 今後に活かせるポイント

- REST 的に「リソース名のパス + メソッドで操作を区別」する設計（`GET /transactions`, `POST /transactions`）は、どのフレームワークでも通用します。設計論は `study/API-Design` 参照。
- 1 件取得・更新・削除を足すなら、パスパラメータを使うのが定石です。

```ts
app.get("/transactions/:id", (c) => {
  const id = c.req.param("id"); // string
  return c.json({ id });
});
```

## 改善するなら

ルートが増えると `index.ts` が肥大化します。リソース単位でサブアプリに分け、`app.route()` でマウントすると見通しが良くなります。

```ts
// src/routes/transactions.ts
import { Hono } from "hono";
export const transactions = new Hono()
  .get("/", (c) => c.json({ transactions: [] }))
  .post("/", async (c) => c.json(await c.req.json(), 201));

// src/index.ts
app.route("/transactions", transactions);
```

なお、上のように `new Hono().get(...).post(...)` とチェーンで書くと、後述の RPC（`hc` クライアント）で型が伝わりやすくなります。

## 次に学ぶこと

- `app.route()` / `app.basePath()` によるルート分割
- 正規表現付きパスパラメータ（`/post/:id{[0-9]+}`）、オプショナルパラメータ（`/:id?`）
- ルーターの種類（RegExpRouter / TrieRouter / LinearRouter / PatternRouter）と `hono/tiny` などのプリセット
