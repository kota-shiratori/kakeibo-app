# OpenAPI: requestBody と responses

## 概要

- **`requestBody`**: クライアントが送るボディの定義。メディアタイプ（`application/json` など）ごとにスキーマを書く。
- **`responses`**: ステータスコードごとのレスポンスの定義。各レスポンスに `description`（必須）と、必要なら `content`（メディアタイプごとのスキーマ・例）や `headers` を書く。

どちらも「`content` → メディアタイプ → `schema` / `examples`」という同じ入れ子構造になっています。

## このプロジェクトでの実装

### requestBody — `backend/openapi.yaml:51-56`

```yaml
requestBody:
  required: true
  content:
    application/json:
      schema:
        $ref: "#/components/schemas/TransactionInput"
```

- `required: true` … ボディ必須（**`requestBody.required` の既定値は `false`** なので明示が必要）。
- `content.application/json` … JSON で送ること。
- `schema` … 中身の形は `TransactionInput`（`backend/openapi.yaml:94-118`）。

### GET の responses — `backend/openapi.yaml:28-43`

```yaml
responses:
  "200":
    description: 取得成功
    content:
      application/json:
        schema:
          $ref: "#/components/schemas/TransactionListResponse"
  "400":
    description: クエリパラメータが不正
    content:
      application/json:
        schema:
          $ref: "#/components/schemas/ErrorResponse"
        examples:
          invalidType:
            $ref: "#/components/examples/InvalidTypeError"
```

### POST の responses — `backend/openapi.yaml:57-76`

```yaml
responses:
  "201":
    description: 登録成功
    content:
      application/json:
        schema:
          $ref: "#/components/schemas/TransactionInput"
  "400":
    description: リクエストボディが不正
    content:
      application/json:
        schema:
          $ref: "#/components/schemas/ErrorResponse"
        examples:
          missingFields:
            $ref: "#/components/examples/MissingFieldsError"
          invalidAmount:
            $ref: "#/components/examples/InvalidAmountError"
          invalidDate:
            $ref: "#/components/examples/InvalidDateError"
```

400 のように **1 つのステータスに複数の原因がある** 場合、`examples` に名前付きで複数の例を並べると、どんなエラーがあり得るかがドキュメント上で一目で分かります。これは実装の 3 つの 400（`backend/src/index.ts:81-91`）と 1 対 1 に対応しています。

## 重要語句

- **Request Body Object**: リクエストボディの定義。`content` が必須。
- **Responses Object**: ステータスコード → Response Object の対応表。
- **Response Object**: 1 つのレスポンスの定義。`description` が必須。
- **Media Type Object**: `content` の中の、メディアタイプ別の定義（`schema`, `example`, `examples`, `encoding`）。
- **`default` レスポンス**: 個別に書いていないステータスコードすべてに対するレスポンス。

## 仕様・注意点

- **Response Object の `description` は必須** です。省略すると仕様違反になります。
- ステータスコードは `"4XX"` のように範囲指定もできます（大文字の `X`）。個別指定（`"400"`）があればそちらが優先されます。
- `example`（単数、値を直接書く）と `examples`（複数、名前付きの Example Object）は同時に使えません。
- POST の 201 のスキーマが `TransactionInput`（**`id` なし**）のままです。以前の「受け取った内容をそのまま返す」実装には合っていましたが、現在の実装は DB に `INSERT ... RETURNING` し、**採番された `id` 付きの行** を返します（`backend/src/index.ts:93-105`。実験では `{"id":1,"item":"給料","amount":10000,"date":"2025-10-01"}`）。つまり **今は仕様が実装に追いついていません**。通常「作成された」リソースには ID が採番されて返るべきなので、直すべきは仕様側です。フロントでも `id` のない型 `NewTransaction = Omit<Transaction, "id">` を送信用に使い分けています（`web-app/src/hooks/transactions.ts:21`）。
- 仕様書には 500 レスポンスがありませんが、実装は壊れた JSON、DB の制約違反（21 文字の `item` など）、DB 接続失敗などで 500（`text/plain`）を返します（→ `18-spec-vs-implementation-gaps.md`）。

## 今後に活かせるポイント

- 「入力用スキーマ」と「出力用スキーマ」を分けておくと（`TransactionInput` と `Transaction`）、ID やサーバーが付ける値（作成日時など）の扱いが明確になります。
- 予期しないエラーを `default` で一括定義しておくと、クライアントは「想定外のエラーでも `ErrorResponse` の形で来る」と期待できます（実装側もそれに合わせる必要があります）。

## 改善するなら

実装はすでに 201 で `Transaction`（`id` 付き）を返しているので、仕様をそれに合わせます。想定外エラーは `default` で定義します。

```yaml
responses:
  "201":
    description: 登録成功
    content:
      application/json:
        schema:
          $ref: "#/components/schemas/Transaction"
  "400":
    description: リクエストボディが不正
    content:
      application/json:
        schema:
          $ref: "#/components/schemas/ErrorResponse"
  default:
    description: 想定外のエラー
    content:
      application/json:
        schema:
          $ref: "#/components/schemas/ErrorResponse"
```

共通のレスポンスは `components/responses` に切り出して再利用することもできます。

```yaml
components:
  responses:
    BadRequest:
      description: リクエストが不正
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/ErrorResponse"
# 使う側
responses:
  "400":
    $ref: "#/components/responses/BadRequest"
```

## 次に学ぶこと

- `links`（あるレスポンスの値を次のリクエストに使う関係の記述）
- レスポンスヘッダー（`Location`, `X-RateLimit-Remaining` など）の記述
