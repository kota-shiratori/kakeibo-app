# HTTP ステータスコードの意味と選び方

## 概要

ステータスコードは、レスポンスの「結果の種類」を 3 桁の数字で表したものです。先頭の数字でグループが決まります。

| 範囲 | 分類 | 代表例 |
| --- | --- | --- |
| 1xx | 情報 | 100 Continue |
| 2xx | 成功 | 200 OK, 201 Created, 204 No Content |
| 3xx | リダイレクト | 301, 302, 304 Not Modified |
| 4xx | クライアントのエラー（リクエストが悪い） | 400, 401, 403, 404, 409, 422, 429 |
| 5xx | サーバーのエラー（サーバー側の問題） | 500, 502, 503 |

「誰のせいで失敗したか」で 4xx と 5xx を分けるのが最大のポイントです。

## このプロジェクトでの実装

| コード | 使っている場所 | 意味 |
| --- | --- | --- |
| 200 OK | `backend/src/index.ts:48` | 一覧取得成功 |
| 201 Created | `backend/src/index.ts:83` | 登録成功 |
| 400 Bad Request | `backend/src/index.ts:26`, `:61`, `:70`, `:79` | `type` が不正 / 必須項目不足 / 金額不正 / 日付形式不正 |
| 204 No Content | Hono の CORS ミドルウェアが OPTIONS に返す | プリフライト応答（→ `20-cors-mechanism-preflight.md`） |
| 500 Internal Server Error | Hono の既定エラーハンドラ | 不正な JSON などで例外が起きたとき（意図して返しているわけではない） |

OpenAPI でも、操作ごとに返しうるコードが書かれています（`backend/openapi.yaml:28-43`, `backend/openapi.yaml:57-76`）。

### 実際に確認した挙動

起動中のサーバーに curl で送って確かめた結果です。

- `GET /transactions`（type なし）→ `400`、JSON の `{ message }`
- `POST /transactions` に壊れた JSON（`{bad`）→ `500`、`content-type: text/plain` で本文 `Internal Server Error`
- `POST /transactions` に JSON の `null` → `500`（`const { item, amount, date } = body;` で null を分割代入して TypeError）

最後の 2 つは本来「クライアントのリクエストが悪い」ので **400 にすべき** ケースです。Hono の `c.req.json()` は中身を `JSON.parse` するだけなので（`backend/node_modules/hono/dist/request.js:104-106`）、パース失敗の例外がそのまま既定のエラーハンドラ（`backend/node_modules/hono/dist/hono-base.js:14-21`）まで届き、500 になります。

## 重要語句

- **200 OK**: 汎用的な成功。GET の成功など。
- **201 Created**: 新しいリソースを作成した。一般に作成したリソースの URL を `Location` ヘッダーで示す。
- **204 No Content**: 成功したが返すボディがない（DELETE の成功など）。
- **400 Bad Request**: リクエストの形式がおかしい（JSON が壊れている、必須項目がない など）。
- **401 Unauthorized**: 認証されていない（ログインしていない、トークンがない・無効）。
- **403 Forbidden**: 認証はされているが権限がない。
- **404 Not Found**: リソースが存在しない（`/transactions/999` など）。
- **409 Conflict**: 現在の状態と衝突する（重複登録、同時更新の衝突など）。
- **422 Unprocessable Content**: 形式（構文）は正しいが、内容が処理できない（意味的なバリデーションエラー）。RFC 9110 で "Unprocessable Entity" から名称変更された。
- **429 Too Many Requests**: レート制限に引っかかった。
- **500 Internal Server Error**: サーバー内部の想定外エラー。

## 仕様・注意点

- **400 と 422 の使い分け** は流派があります。
  - 「JSON として読めない＝400、読めるが値が不正（金額 0、日付が存在しないなど）＝422」と分ける流儀。
  - 「バリデーションエラーはすべて 400」とする流儀（このプロジェクトはこちら）。
  - どちらでも構いませんが、**API 全体で統一** し、OpenAPI に書くことが大切です。
- 500 は「サーバー側のバグ」を意味します。クライアントの入力ミスで 500 が出るのは、ほぼ確実にサーバーの検証漏れです。
- 401 と 403 は名前が紛らわしいので注意（401 は「あなたが誰か分からない」、403 は「あなたが誰か分かったうえで駄目」）。
- `fetch` は 4xx/5xx でも例外を投げません。ステータスを見るのはクライアントの責任です（→ `08-fetch-and-response-ok.md`）。

## 今後に活かせるポイント

これから機能を増やしたときの目安です。

| 状況 | コード |
| --- | --- |
| `GET /transactions/{id}` で該当なし | 404 |
| `DELETE /transactions/{id}` 成功 | 204 |
| `PUT /transactions/{id}` 成功（更新後のデータを返す） | 200 |
| ログインしていない | 401 |
| 他人の収支を操作しようとした | 403（存在自体を隠したいなら 404） |
| DB 接続失敗など | 500（詳細はログに出し、レスポンスには出さない） |

## 改善するなら

不正な JSON を 400 で返すようにします。

```ts
app.post("/transactions", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ message: "リクエストボディが正しいJSONではありません。" }, 400);
  }
  if (typeof body !== "object" || body === null) {
    return c.json({ message: "リクエストボディはオブジェクトである必要があります。" }, 400);
  }
  // ...以降の検証
});
```

想定外の例外も JSON 形式で返したいなら、アプリ全体のエラーハンドラ（Hono の `app.onError`）で `{ message }` を返すようにし、OpenAPI に `500` レスポンスも追記します（Hono の書き方の詳細は study/Hono を参照）。

## 次に学ぶこと

- `Location` ヘッダーと 201 の組み合わせ
- 429 と `Retry-After` ヘッダーを使ったレート制限
