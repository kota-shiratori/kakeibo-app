# CORS の credentials と許可オリジンの設定

## 概要

クロスオリジンのリクエストでは、ブラウザは既定で **Cookie や HTTP 認証などの資格情報（credentials）を送りません**。送るには、クライアントとサーバーの **両方** で明示的な設定が必要です。

- **クライアント**: `fetch(url, { credentials: "include" })`
- **サーバー**: `Access-Control-Allow-Credentials: true` を返す

さらに、資格情報付きリクエストには重要な制約があります。

> **`Access-Control-Allow-Origin: *`（ワイルドカード）は使えない。** 具体的なオリジンを 1 つ返す必要がある。

ワイルドカードで「どこからでも資格情報付きで読める」を許すと、どんなサイトからでもログイン中のユーザーになりすましてデータを読めてしまうためです。同様に、資格情報付きの場合は `Access-Control-Allow-Headers` や `Access-Control-Allow-Methods` の `*` も「ワイルドカード」として扱われません（`*` という名前そのものとして扱われる）。

## このプロジェクトでの実装

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

| オプション | 生成されるヘッダー | 説明 |
| --- | --- | --- |
| `origin: [env.FRONTEND_URL]` | `Access-Control-Allow-Origin` | リクエストの `Origin` が配列に **完全一致** すれば、その値を返す |
| `allowMethods` | `Access-Control-Allow-Methods` | プリフライト応答時のみ付く |
| `allowHeaders` | `Access-Control-Allow-Headers` | プリフライト応答時のみ付く |
| `credentials: true` | `Access-Control-Allow-Credentials: true` | 全レスポンスに付く（curl で確認） |

### 許可オリジンを環境変数から読んでいる

`origin` に直接文字列を書かず、`env.FRONTEND_URL`（`backend/src/env.ts:9`）を使っています。開発環境・本番環境でフロントの URL が変わっても、コードを変えずに環境変数だけで切り替えられる良い設計です（→ `23-env-vars-and-dotenv.md`）。

ワイルドカード `*` ではなく特定のオリジンを指定しているので、`credentials: true` との組み合わせとしても正しい構成です。

### Hono の origin 判定

`backend/node_modules/hono/dist/middleware/cors/index.js:59-65`

```js
const findAllowOrigin = ((optsOrigin) => {
  if (typeof optsOrigin === "string") {
    if (optsOrigin === "*") return () => optsOrigin;
    else return (origin) => optsOrigin === origin ? origin : null;
  } else if (typeof optsOrigin === "function") return optsOrigin;
  else return (origin) => optsOrigin.includes(origin) ? origin : null;
})(opts.origin);
```

配列の場合は `includes` による **文字列の完全一致** です。一致しなければ `Access-Control-Allow-Origin` を付けないだけで、リクエスト自体は処理されます。

## 重要語句

- **資格情報（credentials）**: Cookie、HTTP 認証、TLS クライアント証明書。
- **`fetch` の `credentials` オプション**: `"omit"`（送らない）/ `"same-origin"`（同一オリジンのみ送る、**既定値**）/ `"include"`（常に送る）。
- **`Authorization` ヘッダー**: トークン認証（`Bearer xxx`）で使うヘッダー。CORS では「資格情報」には含まれず、通常のカスタムヘッダーとしてプリフライトで許可が必要。

## 仕様・注意点

- **現状、`credentials: true` は実質的に効いていません。** フロントの `fetch` はどれも `credentials` を指定していない（既定の `"same-origin"`）ため、クロスオリジンの API には Cookie を送っていません（`web-app/src/hooks/useAddTransactions.ts:14-18` など）。将来 Cookie セッション認証を入れるための準備、と読めます。
- 同様に `allowHeaders` の `Authorization` も、現在フロントは送っていません。将来のトークン認証の準備です。
- **`FRONTEND_URL` の末尾スラッシュに注意。** ブラウザが送る `Origin` ヘッダーは `http://localhost:5173` のように **末尾スラッシュもパスもない** 形です。環境変数に `http://localhost:5173/` と書くと完全一致せず、CORS エラーになります。現在のスキーマ `z.string()`（`backend/src/env.ts:9`）ではこの間違いを検出できません（→ `25-zod-env-schema.md`）。
- **Hono で `origin: "*"` と `credentials: true` を組み合わせると**、ミドルウェアは `Access-Control-Allow-Origin: *` と `Access-Control-Allow-Credentials: true` を両方返します（`backend/node_modules/hono/dist/middleware/cors/index.js:61`, `:79`）。ライブラリは止めてくれませんが、ブラウザは資格情報付きリクエストのこのレスポンスを拒否します。
- Cookie をクロスオリジンで送る場合は、Cookie 側の `SameSite` 属性（`None` なら `Secure` 必須）も関係します。

## 今後に活かせるポイント

- 認証方式によって必要な CORS 設定が変わります。
  - **Cookie セッション**: `credentials: true` + `fetch` の `credentials: "include"` + 具体的な origin 指定 + Cookie の `SameSite` / `Secure` 設定 + CSRF 対策。
  - **Bearer トークン（Authorization ヘッダー）**: `allowHeaders` に `Authorization`。Cookie を使わないなら `credentials` は不要。
- 使っていない許可は外しておくと、設定の意図が明確になり安全側に倒せます。

## 改善するなら

### 環境変数を検証して末尾スラッシュを正規化する

```ts
// backend/src/env.ts
FRONTEND_URL: z.url({ protocol: /^https?$/ }).transform((u) => new URL(u).origin),
// "http://localhost:5173/" → "http://localhost:5173" に正規化される
```

### Cookie 認証を導入したときのフロント側

```ts
await fetch(`${BASE_URL}/transactions`, {
  method: "POST",
  credentials: "include", // Cookie を送る
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(transaction),
});
```

### 複数オリジンを許可する（例: プレビュー環境）

```ts
// 環境変数をカンマ区切りで受け取り、配列にする
FRONTEND_URLS: z.string().transform((s) => s.split(",").map((v) => v.trim())),
// ...
cors({ origin: env.FRONTEND_URLS, credentials: true });
```

## 次に学ぶこと

- Cookie セッション認証と JWT（Bearer トークン）認証の比較
- CSRF 対策（`SameSite=Lax`、CSRF トークン、Hono の `csrf` ミドルウェア）
