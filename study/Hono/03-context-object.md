# Context オブジェクト `c`

## 概要

Hono のハンドラやミドルウェアは、引数として **Context（慣習的に `c`）** を受け取ります。Context は「今回のリクエストに関する情報」と「レスポンスを作るための道具」をひとまとめにしたオブジェクトです。

- 入力側: `c.req`（`HonoRequest`。クエリ・ヘッダ・ボディなどを読む）
- 出力側: `c.json()` / `c.text()` / `c.html()` / `c.body()` / `c.redirect()` など（`Response` を作る）
- その他: `c.header()`（レスポンスヘッダ設定）、`c.status()`、`c.set()` / `c.get()`（ミドルウェア→ハンドラの値受け渡し）、`c.env`（ランタイム固有の値）、`c.res`（現在のレスポンス）

Express の `req` と `res` が 1 つにまとまったもの、とイメージすると分かりやすいです。

## このプロジェクトでの実装

`backend/src/index.ts:29-30`

```ts
app.get("/transactions", async (c) => {
  const type = c.req.query("type");
```

`backend/src/index.ts:77-78`

```ts
app.post("/transactions", async (c) => {
  const body = await c.req.json();
```

`backend/src/index.ts:74`

```ts
  return c.json(result, 200);
```

このプロジェクトで使っている Context の機能は次の 3 つです。

| 機能 | 場所 | 詳細 |
| --- | --- | --- |
| `c.req.query("type")` | 30 行目 | クエリ文字列の取得（→ 04 章） |
| `await c.req.json()` | 78 行目 | JSON ボディの取得（→ 05 章） |
| `c.json(body, status)` | 33, 74, 82, 86, 90, 105 行目 | JSON レスポンスの生成（→ 07 章） |

また `cors` ミドルウェアの内部でも、`c.req.header("origin")` で Origin ヘッダを読み、`c.res.headers.set(...)` でレスポンスヘッダを書いています（`node_modules/hono/dist/middleware/cors/index.js`）。

## 重要語句

| 用語 | 意味 |
| --- | --- |
| `Context` | 1 リクエストごとに新しく作られる、入出力をまとめたオブジェクト |
| `c.req` | `HonoRequest`。Web 標準の `Request` を包み、便利メソッドを足したもの |
| `c.req.raw` | 包まれている生の Web 標準 `Request` |
| `c.req.param()` / `query()` / `queries()` / `header()` | パス・クエリ・ヘッダの取得 |
| `c.req.json()` / `text()` / `parseBody()` / `formData()` / `arrayBuffer()` | ボディの取得（Promise を返す） |
| `c.json()` / `c.text()` / `c.html()` / `c.body()` / `c.redirect()` | `Response` を生成するヘルパー |
| `c.header(name, value)` | レスポンスヘッダを設定 |
| `c.set(key, value)` / `c.get(key)` / `c.var` | リクエスト内で値を共有（例: 認証ミドルウェアがユーザー情報を入れる） |
| `c.env` | ランタイムから渡される環境（Workers なら Bindings、Node.js なら `incoming`/`outgoing`） |

## 仕様・注意点

- Context は **リクエストごとに生成** されます。グローバル変数に入れて使い回してはいけません。
- `c.req` の各メソッドは `HonoRequest` 独自のものです。Web 標準の `Request` が必要な場面（他ライブラリに渡すなど）では `c.req.raw` を使います。
- `c.env` の中身はランタイムによって違います。`@hono/node-server` では `{ incoming: IncomingMessage, outgoing: ServerResponse }` が入ります（`@hono/node-server` README「Accessing Node.js API」）。このプロジェクトは環境変数を `c.env` ではなく `process.env` 経由（`backend/src/env.ts`）で読んでいます。本番の Vercel Functions でも環境変数は `process.env` に入るので、この書き方のまま動きます。
- 型付けしたい場合は `new Hono<{ Bindings: ...; Variables: ... }>()` のようにジェネリクスで指定します。

## 今後に活かせるポイント

- 「ミドルウェアで `c.set` → ハンドラで `c.get`」は認証やリクエスト ID 付与の定番パターンです。

```ts
type Variables = { userId: string };
const app = new Hono<{ Variables: Variables }>();

app.use("/*", async (c, next) => {
  c.set("userId", "u_123"); // 本来はトークンを検証して取り出す
  await next();
});

app.get("/me", (c) => c.json({ userId: c.get("userId") }));
```

## 改善するなら

GET ハンドラ（`index.ts:29-75`）の中に、Context 操作・SQL の組み立てと実行・行の変換・集計（合計金額の `reduce`）が混在しています。Context にも DB にも依存しない純粋関数に切り出すと、単体テストしやすくなります。

```ts
// Context も DB も知らない純粋関数
const summarize = (list: { amount: number }[]) => ({
  transactions: list,
  totalCount: list.length,
  totalAmount: list.reduce((s, t) => s + t.amount, 0),
});

app.get("/transactions", async (c) => {
  // ... type の検証
  const transactions = await repo.list(type); // SQL はリポジトリ層へ（../Architecture/15-persistence-and-repository-layer.md）
  return c.json(summarize(transactions), 200);
});
```

`totalCount` を `list.length` から求めれば、今の `COUNT(*)` 用の 2 本目の SQL（`index.ts:42`, `54`）も不要になります。

## 次に学ぶこと

- `c.var` と `createMiddleware`（`hono/factory`）による型安全な変数受け渡し
- `c.executionCtx`（Workers の `waitUntil` など）
- `c.render` / `c.setRenderer` と JSX（→ 14 章）
