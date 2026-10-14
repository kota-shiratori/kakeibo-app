# OpenAPI: parameters（クエリパラメータの定義）

## 概要

Operation の `parameters` には、ボディ以外でクライアントが渡す値を定義します。`in` で場所を指定します。

| `in` の値 | 場所 | 例 |
| --- | --- | --- |
| `path` | パスの一部 | `/transactions/{id}` の `id` |
| `query` | クエリ文字列 | `?type=income` |
| `header` | リクエストヘッダー | `X-Request-Id` |
| `cookie` | クッキー | `session_id` |

## このプロジェクトでの実装

### 操作側: `$ref` で参照するだけ — `backend/openapi.yaml:26-27`

```yaml
parameters:
  - $ref: "#/components/parameters/TransactionType"
```

### 定義本体: `components/parameters` — `backend/openapi.yaml:79-91`

```yaml
components:
  parameters:
    TransactionType:
      name: type
      in: query
      required: true
      description: 取得する収支の種別
      schema:
        type: string
        enum:
          - income
          - expense
          - all
      example: all
```

| フィールド | 意味 |
| --- | --- |
| `name` | パラメータ名。URL 上は `?type=...` |
| `in` | 場所（ここでは `query`） |
| `required` | 必須かどうか。`true` なので省略不可 |
| `description` | 説明 |
| `schema` | 値の型と制約。`enum` で 3 つの値のみ許可 |
| `example` | 例の値。ドキュメント画面のお試し実行で初期値として使われることが多い |

`components` 側のキー名 `TransactionType` は仕様書内での部品名、`name: type` は実際のクエリ名で、**別物** である点に注意です。

### 実装との対応 — `backend/src/index.ts:30-49`

```ts
const type = c.req.query("type");
if (!type || !["income", "expense", "all"].includes(type)) {
  return c.json({ message: "..." }, 400);
}
```

- `required: true` → `!type` で未指定を 400 に。
- `enum: [income, expense, all]` → `includes(type)` で 3 値以外を 400 に。
- 値の意味 → `income` なら `WHERE amount > 0`、`expense` なら `WHERE amount < 0`、`all` なら条件なしで SQL を組み立てる（`backend/src/index.ts:41-49`）。

```ts
if (type === "income" || type === "expense") {
  const addTypeQuery =
    type === "income" ? ` WHERE amount > 0` : ` WHERE amount < 0`;
  historyQuery += addTypeQuery;
  countQuery += addTypeQuery;
}
```

この部分は仕様と実装が一致しています（`app.request()` で `?type=foo` と未指定がどちらも 400、`?type=expense` では負の金額の行だけが返ることを確認）。

`type` の値そのものは SQL に連結していません。連結しているのは、検証済みの `type` に応じて選んだ **固定の文字列**（`" WHERE amount > 0"` など）だけなので、SQL インジェクションの心配はありません（→ `../SQL/11-placeholders-and-sql-injection.md`）。

## 重要語句

- **Parameter Object**: パラメータ 1 つ分の定義。
- **`in`**: パラメータの場所。`path` / `query` / `header` / `cookie`。
- **`enum`**: 許可する値の列挙（→ `16-openapi-schema-keywords.md`）。
- **`style` / `explode`**: 配列やオブジェクトをクエリでどう表現するかの指定（既定は `form` / `true` で `?tag=a&tag=b`）。

## 仕様・注意点

- **`in: path` のパラメータは `required: true` が必須** です（パスの一部なので省略できない）。
- パラメータは **`name` と `in` の組み合わせで一意** です。同じ名前でも `in` が違えば別物です。
- `example` と `examples`（複数の名前付き例）は同時に指定できません。
- クエリの値は HTTP 上は常に文字列なので、`schema: { type: integer }` としても、実装側では文字列から数値への変換と検証が必要です。
- `components/parameters` に切り出すと、同じパラメータを複数の操作から再利用できます。今は `GET /transactions` だけですが、将来「収支の集計 API」などで同じ `type` を使うときに便利です。

## 今後に活かせるポイント

- ページネーションなど共通のパラメータ（`limit`, `cursor`）は、最初から `components/parameters` に定義しておくと統一しやすいです。
- フロントで使う型も仕様書の `enum` と揃えましょう。現在フロントでは `"income" | "expense"` という型を独自に定義しています（`web-app/src/pages/Input.tsx:17`）。仕様書から型を生成すれば二重管理を避けられます。

## 改善するなら

必須をやめて既定値を持たせる案（→ `03-query-params-vs-request-body.md`）:

```yaml
TransactionType:
  name: type
  in: query
  required: false
  description: 取得する収支の種別（省略時は all）
  schema:
    type: string
    enum: [income, expense, all]
    default: all
```

将来のページネーション用パラメータの例:

```yaml
Limit:
  name: limit
  in: query
  required: false
  schema:
    type: integer
    minimum: 1
    maximum: 100
    default: 20
```

## 次に学ぶこと

- `style` / `explode` による配列・オブジェクトのシリアライズ規則
- ヘッダーパラメータ（`Idempotency-Key` など）の記述
