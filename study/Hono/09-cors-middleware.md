# `hono/cors` ミドルウェアの使い方

## 概要

フロントエンド（Vite の開発サーバー）とバックエンド（`localhost:3000`）はオリジンが異なるため、ブラウザから API を呼ぶには **CORS ヘッダ** が必要です。Hono では組み込みの `cors()` ミドルウェアを `app.use` するだけで対応できます。

> CORS の概念そのもの（同一オリジンポリシー、プリフライトリクエスト、credentials の意味など）は `study/API-Design` を参照してください。ここでは **Hono の `cors()` の書き方・オプション・実際の挙動** に絞ります。

## このプロジェクトでの実装

`backend/src/index.ts:3`

```ts
import { cors } from "hono/cors";
```

`backend/src/index.ts:8-16`

```ts
app.use(
  "/*",
  cors({
    origin: [env.FRONTEND_URL],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);
```

- `origin` には環境変数 `FRONTEND_URL`（`backend/src/env.ts` で定義）を配列で渡しています。オリジンをコードに直書きせず、環境ごとに切り替えられるようにしているわけです。
- フロントの POST（`web-app/src/hooks/useAddTransactions.ts:16`）は `Content-Type: application/json` を付けるため、ブラウザはプリフライト（OPTIONS）を送ります。`allowHeaders` に `Content-Type` が入っているのはそのためです。

## 重要語句（オプション一覧）

型定義 `node_modules/hono/dist/types/middleware/cors/index.d.ts`（Hono 4.13.13）より。

| オプション | 型 | 既定値 | 対応するヘッダ / 意味 |
| --- | --- | --- | --- |
| `origin` | `string \| string[] \| (origin, c) => string \| null \| undefined \| Promise<...>` | `"*"` | `Access-Control-Allow-Origin`。許可するオリジン |
| `allowMethods` | `string[] \| (origin, c) => string[] \| Promise<string[]>` | `['GET','HEAD','PUT','POST','DELETE','PATCH','QUERY']` | `Access-Control-Allow-Methods`（プリフライト時のみ） |
| `allowHeaders` | `string[]` | `[]` | `Access-Control-Allow-Headers`（プリフライト時のみ） |
| `maxAge` | `number` | なし | `Access-Control-Max-Age`（プリフライト結果のキャッシュ秒数） |
| `credentials` | `boolean` | なし | `Access-Control-Allow-Credentials: true` |
| `exposeHeaders` | `string[]` | `[]` | `Access-Control-Expose-Headers`（JS から読めるレスポンスヘッダ） |

## 仕様・注意点

実装（`node_modules/hono/dist/middleware/cors/index.js`）を読み、`app.request()` で実験して確認した挙動です。

### 1. `origin` の照合方法

- 文字列 `"*"` → 常に `*` を返す
- 文字列（`"*"` 以外） → リクエストの `Origin` と **完全一致** したときだけ、その Origin を返す
- 配列 → `includes` で **完全一致** するものがあればその Origin を返す（このプロジェクトはこれ）
- 関数 → 戻り値をそのまま使う（動的に判定したい場合）

完全一致なので、`http://localhost:5173` と `http://localhost:5173/`（末尾スラッシュ）や `http://127.0.0.1:5173` は **別物** です。環境変数の値の書き方に注意しましょう。

### 2. 許可されていないオリジンからのリクエストも「処理はされる」

`Origin: http://evil.example` で GET すると、**ステータス 200 でボディも返り**、`Access-Control-Allow-Origin` ヘッダが付かないだけでした。CORS はあくまで **ブラウザが** レスポンスを JS に渡すかどうかを決める仕組みで、サーバー側でリクエストを拒否するものではありません。curl などからは普通に叩けます。認可が必要なら別途認証を実装します。

### 3. プリフライト（OPTIONS）はミドルウェアが直接 204 を返す

`c.req.method === "OPTIONS"` のとき、cors ミドルウェアは `next()` を呼ばずに `new Response(null, { status: 204 })` を返します。

- そのため **`app.options(...)` ルートを自分で書く必要はありません**。
- 実験では **存在しないパス `/nope` への OPTIONS でも 204** が返りました（ルートの有無を見ていない）。
- プリフライト応答に付いたヘッダ（実験結果）:
  `access-control-allow-origin`, `access-control-allow-credentials: true`, `access-control-allow-methods: GET,POST,PUT,DELETE,OPTIONS`, `access-control-allow-headers: Content-Type,Authorization`, `vary: Origin, Access-Control-Request-Headers`

### 4. `allowMethods` / `allowHeaders` はプリフライト時だけ使われる

通常の GET/POST レスポンスには `Allow-Methods` / `Allow-Headers` は付きません（`Allow-Origin`, `Allow-Credentials`, `Expose-Headers`, `Vary: Origin` のみ）。

- `allowHeaders` を空のままにすると、リクエストの `Access-Control-Request-Headers` をそのまま反映して返します（実装で確認）。
- `allowMethods` に `"OPTIONS"` を含めても害はありませんが、プリフライト自体は cors ミドルウェアが処理するので必須ではありません。

### 5. `credentials: true` と `origin: "*"` は組み合わせない

ブラウザの仕様上、credentials 付きリクエストでは `Access-Control-Allow-Origin: *` が受け入れられません。このプロジェクトのように **具体的なオリジンを指定** するのが正しい組み合わせです。なお Hono の実装は `credentials` が true なら常に `Allow-Credentials: true` を付けるだけで、この組み合わせを止めてはくれません。

### 6. `Vary: Origin`

`origin` が `"*"` 以外のとき、Hono は `Vary: Origin` を付けます（キャッシュがオリジンごとに分かれるようにするため）。

### 7. 登録位置

cors は **ルートより前**、かつ認証ミドルウェアなどより **前** に置くのが基本です。認証ミドルウェアが先にあると、プリフライト（認証ヘッダを持たない）が 401 で弾かれてしまいます。

## 今後に活かせるポイント

- 環境変数でオリジンを切り替えるパターンはそのまま再利用できます。複数オリジンを許可したいなら、カンマ区切りの環境変数を配列にするなど。
- 関数形式の `origin` で、サブドメインをまとめて許可するなどの柔軟な判定ができます。

```ts
cors({
  origin: (origin) =>
    origin.endsWith(".example.com") ? origin : null,
});
```

## 改善するなら

1. 現状フロントは Cookie や `Authorization` ヘッダを送っていない（`useAddTransactions.ts` は `Content-Type` のみ）ので、`credentials: true` と `Authorization` は **将来の認証用の先回り設定** です。不要な許可は最小化する方が安全です。
2. 実際に使うメソッドは GET と POST のみなので、絞れます。
3. プリフライトの往復を減らしたいなら `maxAge` を指定します。

```ts
app.use(
  "/*",
  cors({
    origin: [env.FRONTEND_URL],
    allowMethods: ["GET", "POST"],
    allowHeaders: ["Content-Type"],
    maxAge: 600,
    // 認証を導入したら credentials / Authorization を追加
  }),
);
```

## 次に学ぶこと

- CORS の仕組み・プリフライトの条件 → `study/API-Design`
- 環境変数（`FRONTEND_URL`）と t3-env による検証 → `study/API-Design`
- `hono/csrf` ミドルウェア（Cookie 認証を導入する場合の CSRF 対策）
- Vite の `server.proxy` で同一オリジン化し、開発時の CORS を不要にする方法（Tooling 寄りの話題）
