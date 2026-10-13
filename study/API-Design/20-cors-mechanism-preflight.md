# CORS の仕組み: 単純リクエストとプリフライト（OPTIONS）

## 概要

CORS（Cross-Origin Resource Sharing）は、**サーバーがレスポンスヘッダーで「このオリジンからのアクセスは許可する」と宣言し、ブラウザがそれを確認する** 仕組みです。

クロスオリジンのリクエストは、ブラウザによって 2 種類に分けられます。

### 1. 単純リクエスト（simple request）

次の条件をすべて満たすものは、プリフライトなしでいきなり送られます。

- メソッドが `GET`, `HEAD`, `POST` のいずれか
- 手動で付けたヘッダーが CORS セーフリストのもの（`Accept`, `Accept-Language`, `Content-Language`, `Content-Type`, `Range`）だけ
- `Content-Type` を付ける場合、値が `application/x-www-form-urlencoded`, `multipart/form-data`, `text/plain` のいずれか

ブラウザはレスポンスの `Access-Control-Allow-Origin` を確認し、許可されていなければ **JavaScript にレスポンスを渡しません**（`fetch` は `TypeError` で reject）。

### 2. プリフライトが必要なリクエスト

上の条件を満たさないもの（`PUT` / `DELETE`、`Content-Type: application/json`、`Authorization` ヘッダー付きなど）は、本番のリクエストの前に、ブラウザが自動で **`OPTIONS` メソッドの「事前確認（プリフライト）」** を送ります。

```http
OPTIONS /transactions HTTP/1.1
Origin: http://localhost:5173
Access-Control-Request-Method: POST
Access-Control-Request-Headers: content-type
```

サーバーが許可を返すと、ブラウザは本番の `POST` を送ります。許可されなければ、本番のリクエストは **送られません**。

## このプロジェクトでの実装

| フロントのリクエスト | 種類 | 理由 |
| --- | --- | --- |
| `GET /transactions?type=income`（`web-app/src/hooks/useIncomeTransactions.ts:15`） | 単純リクエスト | GET で、追加ヘッダーなし |
| `POST /transactions` + `Content-Type: application/json`（`web-app/src/hooks/useAddTransactions.ts:14-18`） | **プリフライトあり** | `application/json` はセーフリスト外 |

バックエンドの CORS 設定: `backend/src/index.ts:8-16`

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

- `allowHeaders` に `Content-Type` が入っているので、JSON の POST のプリフライトが通ります。
- `"/*"` で全パスに適用しているので、`OPTIONS /transactions` にもミドルウェアが応答します（ルートとして `app.options` を定義していなくてもよい）。

### 実際のプリフライト応答（curl で確認）

```
OPTIONS /transactions
→ HTTP/1.1 204 No Content
  access-control-allow-credentials: true
  access-control-allow-headers: Content-Type,Authorization
  access-control-allow-methods: GET,POST,PUT,DELETE,OPTIONS
  vary: Origin, Access-Control-Request-Headers
```

（この確認では許可リストにない Origin を送ったため `Access-Control-Allow-Origin` は付いていません。許可リストにある Origin なら、その Origin の値がそのまま返ります。）

Hono の実装では、`OPTIONS` リクエストのときにこれらのヘッダーを付けて **204 No Content を即座に返し、後続のハンドラは実行しません**（`backend/node_modules/hono/dist/middleware/cors/index.js:81-102`）。

## 重要語句

| ヘッダー | 方向 | 意味 |
| --- | --- | --- |
| `Origin` | リクエスト | 送信元のオリジン（ブラウザが自動付与） |
| `Access-Control-Request-Method` | プリフライト | 本番で使いたいメソッド |
| `Access-Control-Request-Headers` | プリフライト | 本番で付けたいヘッダー |
| `Access-Control-Allow-Origin` | レスポンス | 許可するオリジン（1 つ、または `*`） |
| `Access-Control-Allow-Methods` | プリフライト応答 | 許可するメソッド |
| `Access-Control-Allow-Headers` | プリフライト応答 | 許可するリクエストヘッダー |
| `Access-Control-Allow-Credentials` | レスポンス | Cookie などの資格情報付きリクエストを許可するか |
| `Access-Control-Max-Age` | プリフライト応答 | プリフライト結果をキャッシュしてよい秒数 |
| `Access-Control-Expose-Headers` | レスポンス | JavaScript から読めるようにするレスポンスヘッダー |
| `Vary: Origin` | レスポンス | 「Origin によって応答が変わる」ことをキャッシュに伝える |

## 仕様・注意点

- **CORS はサーバーを守る仕組みではなく、ブラウザのユーザーを守る仕組み** です。単純リクエストは CORS で許可されていなくても **サーバーまで届いて処理されます**。実際、許可リストにない Origin を付けて `POST` を curl で送っても、サーバーは 201 を返しました（curl はブラウザではないので CORS を確認しません）。
- そのため「CORS を設定したから他サイトからの書き込みは防げる」とは考えないこと。特に `c.req.json()` は `text/plain` のボディも JSON として処理するので（→ `07-json-and-content-type.md`）、他サイトのページからプリフライトなしの `text/plain` POST を送り込める余地があります。保存処理を実装するなら、Content-Type の確認や CSRF 対策を検討しましょう。
- プリフライトは本番リクエストのたびに発生しうるので、`maxAge` を設定するとリクエスト回数を減らせます（ブラウザごとに上限あり）。
- `Access-Control-Allow-Origin` には **オリジンを 1 つだけ** 書けます（カンマ区切りで複数は不可）。複数許可したい場合、Hono のようにリクエストの `Origin` が許可リストにあればその値を返す、という実装になります（`backend/node_modules/hono/dist/middleware/cors/index.js:59-65`）。
- `allowMethods` に `OPTIONS` を含めているのは害はありませんが、プリフライト自体の許可には不要です。

## 今後に活かせるポイント

- CORS エラーの調べ方: ブラウザの開発者ツール → ネットワークタブで、`OPTIONS` リクエストが出ているか、そのレスポンスに必要な `Access-Control-Allow-*` が揃っているかを確認します。
- 新しいカスタムヘッダー（例: `Idempotency-Key`）を使うときは、`allowHeaders` への追加を忘れないこと。

## 改善するなら

プリフライトのキャッシュ時間を指定する例:

```ts
cors({
  origin: [env.FRONTEND_URL],
  allowMethods: ["GET", "POST", "PUT", "DELETE"],
  allowHeaders: ["Content-Type", "Authorization"],
  maxAge: 600, // 10 分間プリフライト結果をキャッシュ
  credentials: true,
});
```

## 次に学ぶこと

- `Access-Control-Expose-Headers` でページネーション用ヘッダー（`Link` など）をフロントから読めるようにする
- Private Network Access（公開サイトからローカルネットワークへのアクセス制限）
