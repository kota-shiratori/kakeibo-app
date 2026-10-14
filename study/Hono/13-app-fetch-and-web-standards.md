# `app.fetch` と Web 標準 ― なぜ Node 以外でも動くのか

## 概要

Hono アプリの入口は `app.fetch` です。これは

```ts
(request: Request, env?, executionCtx?) => Response | Promise<Response>
```

という形の関数で、**Web 標準の `Request` を受け取り `Response` を返す** だけです。この「fetch ハンドラ」という形は、Cloudflare Workers、Deno、Bun などが共通して採用しているサーバーのインターフェースです。Hono はこの形に合わせて作られているため、**アプリのコードを変えずに複数のランタイムで動かせます**。

Node.js だけは歴史的に独自の `req`/`res` API を使っているので、間に変換役（`@hono/node-server`）が必要になります。

## このプロジェクトでの実装

このプロジェクトでは、同じ `app` を 2 つの入口から使っています。

`backend/src/index.ts:108`（アプリ本体を公開する）

```ts
export default app;
```

`backend/src/dev.ts:6`（ローカル開発：Node.js で起動する）

```ts
serve({ fetch: app.fetch, port: 3000 }, (info) => {
```

| 環境 | 入口 | `app.fetch` を呼ぶのは誰か |
| --- | --- | --- |
| ローカル（`npm run dev`） | `dev.ts` | `@hono/node-server` の `serve()` |
| 本番（Vercel Functions） | `index.ts` の `export default app` | Vercel（`dev.ts` は使われない。`dev.ts:1` のコメント） |

ローカルで `app.fetch` を `serve()` に渡しているのが、Hono と Node.js の接点です。

```
ブラウザ
  │ HTTP
  ▼
Node.js http.Server（@hono/node-server が作成）
  │ IncomingMessage → Request に変換
  ▼
app.fetch(request, { incoming, outgoing })
  │ ルーティング → ミドルウェア → ハンドラ
  ▼
Response
  │ Response → ServerResponse に書き戻し
  ▼
ブラウザ
```

`app.fetch` の実装（`node_modules/hono/dist/hono-base.js`）:

```js
fetch = (request, ...rest) => {
  return this.#dispatch(request, rest[1], rest[0], request.method);
};
```

第 2 引数が `env`（`c.env` になる）、第 3 引数が `executionCtx`（`c.executionCtx` になる）です。

## 重要語句

| 用語 | 意味 |
| --- | --- |
| `Request` / `Response` / `Headers` | WHATWG Fetch 標準で定義されたクラス。ブラウザ・Deno・Bun・Workers・Node.js 18+ に存在 |
| fetch ハンドラ | `(Request) => Response` 形式のサーバー関数 |
| `env`（Bindings） | ランタイムが渡す追加情報。Workers では環境変数や KV などのバインディング、Node.js アダプターでは `incoming`/`outgoing` |
| `executionCtx` | Workers の `ExecutionContext`（`waitUntil` など） |
| アダプター | ランタイム固有の API と fetch ハンドラを変換する層 |

## 仕様・注意点

### 主なランタイムでの起動方法（Hono 公式ドキュメントの Getting Started に基づく）

| ランタイム | 起動コードの例 |
| --- | --- |
| Node.js | `serve({ fetch: app.fetch, port: 3000 })`（`@hono/node-server`）。このプロジェクトの `dev.ts` |
| Vercel（Functions） | `export default app`。このプロジェクトの `index.ts`（Vercel の Hono 向けのゼロ設定デプロイ。Vercel 側の内部動作はこのノートでは未確認） |
| Cloudflare Workers | `export default app`（Workers は default export の `fetch` メソッドを呼ぶ） |
| Bun | `export default app`（Bun は default export の `fetch` を使う。`port` プロパティ付きのオブジェクトを export しても良い） |
| Deno | `Deno.serve(app.fetch)` |

いずれも「`app` は同じ、最後の 1〜数行だけ違う」という点がポイントです。

### このプロジェクトをそのまま他ランタイムへ持っていけるか？

**ルーティングとハンドラの書き方は移植可能ですが、周辺は Node.js 依存** です。

- `backend/src/env.ts` が `process.env` を使っている（Workers では環境変数は `c.env` で受け取るのが基本）。`.env` を読む `dotenv` は `dev.ts` 側に分離済み
- `pg`（node-postgres）は Node.js の TCP ソケットで DB に接続する。Workers などでは、そのランタイム向けのドライバ（HTTP 経由で接続するものなど）や接続方法に置き換える必要がある
- `@vercel/functions` の `attachDatabasePool` は Vercel Functions 専用（`../PostgreSQL/08-neon-and-vercel-attach-database-pool.md`）
- `@hono/node-server` の `serve` は Node.js 専用（ただし `dev.ts` に閉じ込められている）

「`app` 定義」と「起動」の分離は `index.ts` / `dev.ts` の分割で実現済みです（コミット `2a1609f`）。次の一歩は、**DB 接続（Pool）と環境変数の読み込みも `app` 定義から外へ出す** ことです（01 章の改善案）。

### その他

- `@hono/node-server` は既定（`overrideGlobalObjects: true`）で、グローバルの `Request`/`Response` を高速な軽量実装に差し替えます。通常は意識不要ですが、`instanceof Response` の判定などで問題が出たら `false` にできます（README で確認）。
- Hono は `HEAD` を自動的に GET で処理するなど、Web 標準の振る舞いに沿って実装されています。

## 今後に活かせるポイント

- 「アプリ = fetch 関数」と捉えると、**サーバーを起動せずにテスト** できます（`app.request()` や `app.fetch(new Request(...))`、15 章）。
- 同じ考え方で、Next.js の Route Handler の中に Hono を埋め込む（`hono/vercel` の `handle(app)`）など、他フレームワークとの組み合わせも可能です。

```ts
// サーバーを立てずに直接呼ぶ例
const res = await app.fetch(new Request("http://localhost/transactions?type=all"));
console.log(res.status, await res.json());
```

## 改善するなら

「Node.js で開発しつつ本番は Vercel」という形は、すでにエントリーポイントの分割（`dev.ts` / `index.ts`）で実現しています。さらに DB 接続をアプリ定義から外に出すと、エントリーごとに接続方法を変えられ、テストでは DB なしの実装を渡せます。

```
src/
  app.ts          ← createApp(repo)：Hono アプリ定義（ランタイム・DB 非依存）
  index.ts        ← Vercel 用：Pool を作り、export default createApp(pgRepo)
  dev.ts          ← ローカル用：serve({ fetch: app.fetch, port })（今のまま）
```

環境変数も `process.env` 直読みではなく、ミドルウェアで `c.env` から取り出す形にすると、より移植しやすくなります（環境変数の扱いは `study/API-Design` 参照）。

## 次に学ぶこと

- `hono/adapter` の `env(c)` ヘルパー（ランタイム差を吸収して環境変数を読む）
- 各ランタイム用アダプター: `hono/aws-lambda`, `hono/vercel`, `hono/cloudflare-workers` など
- WinterTC（旧 WinterCG）: サーバーサイド JS ランタイムの Web 標準 API 互換を進める取り組み
