# REST の基本とリソース設計

## 概要

REST（Representational State Transfer）は、Web API を設計するときの代表的な考え方です。厳密な規格ではなく「設計スタイル」ですが、実務では次のような約束ごととして使われます。

- **リソース（もの）を URL で表す**: `/transactions`（収支の集まり）、`/transactions/1`（ID=1 の収支）のように、URL には「名詞」を置く。
- **操作は HTTP メソッドで表す**: 取得は `GET`、作成は `POST`、置き換えは `PUT`、部分更新は `PATCH`、削除は `DELETE`。
- **やり取りするデータは「表現（representation）」**: サーバー内部のデータ構造そのものではなく、JSON などの形式で表したもの。
- **ステートレス**: 1 回のリクエストに必要な情報はすべてそのリクエストに含める（サーバーは前回のリクエストを覚えていない前提）。

「動詞を URL に入れない」のが大きなポイントです。`/getTransactions` や `/createTransaction` ではなく、`GET /transactions` と `POST /transactions` のように **同じ URL にメソッドを変えてアクセスする** 形にします。

## このプロジェクトでの実装

バックエンドは `/transactions` という 1 つのリソースに、2 つのメソッドを割り当てています。

`backend/src/index.ts:18`

```ts
app.get("/transactions", async (c) => {
```

`backend/src/index.ts:51`

```ts
app.post("/transactions", async (c) => {
```

OpenAPI 仕様書でも、1 つのパスの下にメソッドごとの操作がぶら下がる形になっています。

`backend/openapi.yaml:18-20`, `backend/openapi.yaml:45`

```yaml
paths:
  /transactions:
    get:
      ...
    post:
      ...
```

| メソッド + パス | 意味 | 実装 |
| --- | --- | --- |
| `GET /transactions?type=...` | 収支の一覧を取得 | `backend/src/index.ts:18-49` |
| `POST /transactions` | 収支を 1 件作成 | `backend/src/index.ts:51-84` |

フロントエンド側も、同じ URL に対してメソッドを変えて呼んでいます。

- 取得: `web-app/src/hooks/useIncomeTransactions.ts:15` — `fetch(\`${BASE_URL}/transactions?type=income\`)`（メソッド省略時は GET）
- 作成: `web-app/src/hooks/useAddTransactions.ts:14-18` — `method: "POST"`

なお、CORS 設定では `PUT` と `DELETE` も許可されていますが（`backend/src/index.ts:12`）、現時点でそれらのルートは存在しません。今後「更新」「削除」を追加するときの準備と読めます。

## 重要語句

- **リソース**: API で扱う「もの」。ここでは収支（transaction）。
- **コレクション**: リソースの集まり。`/transactions` は収支のコレクション。
- **アイテム（個別リソース）**: コレクション内の 1 件。慣習的に `/transactions/{id}` で表す。
- **エンドポイント**: 「メソッド + パス」の組み合わせ。例: `GET /transactions`。
- **ステートレス**: サーバーがリクエスト間の状態を持たないこと。

## 仕様・注意点

- コレクション名は **複数形** にするのが一般的です（`/transaction` ではなく `/transactions`）。このプロジェクトもそうなっています。
- REST はあくまでスタイルなので、「絶対の正解」はありません。チーム内で一貫していることが一番大切です。
- 「検索」「集計」のように名詞にしづらい操作は、クエリパラメータ（`?type=income`）で表現するのがよくある解決策です（→ `03-query-params-vs-request-body.md`）。

## 今後に活かせるポイント

- 新しい機能を追加するときは、まず「どのリソースに対する、どの操作か」を考えると URL が自然に決まります。
- 例: 収支の更新 → `PUT /transactions/{id}` または `PATCH /transactions/{id}`、削除 → `DELETE /transactions/{id}`、1 件取得 → `GET /transactions/{id}`。

## 改善するなら

個別リソース用のパスがまだありません。今後追加するなら、OpenAPI では次のようにパスパラメータを使います。

```yaml
paths:
  /transactions/{id}:
    parameters:
      - name: id
        in: path
        required: true   # パスパラメータは必ず required: true
        schema:
          type: integer
    get:
      operationId: getTransaction
      responses:
        "200": { description: 取得成功 }
        "404": { description: 指定した収支が存在しない }
    delete:
      operationId: deleteTransaction
      responses:
        "204": { description: 削除成功（ボディなし） }
        "404": { description: 指定した収支が存在しない }
```

## 次に学ぶこと

- ネストしたリソース（例: `/users/{userId}/transactions`）をどこまで深くするか
- REST 以外の選択肢: GraphQL、RPC 系（tRPC、gRPC）、Hono RPC（型を共有したクライアント生成）
