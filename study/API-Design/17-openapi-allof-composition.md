# OpenAPI: allOf によるスキーマの合成（Transaction = id + TransactionInput）

## 概要

`allOf` は「**列挙したすべてのスキーマを同時に満たす**」という意味のキーワードです。既存のスキーマにプロパティを付け足して新しいスキーマを作る（継承や交差型のような）用途でよく使われます。

TypeScript でいえば、交差型（`&`）に近い考え方です。

```ts
type Transaction = { id: number } & TransactionInput;
```

## このプロジェクトでの実装

`backend/openapi.yaml:120-131`

```yaml
Transaction:
  description: 登録済みの収支
  allOf:
    - type: object
      required:
        - id
      properties:
        id:
          type: integer
          description: 収支ID
          example: 1
    - $ref: "#/components/schemas/TransactionInput"
```

- 1 つ目: `id`（整数・必須）を持つオブジェクト。
- 2 つ目: 既存の `TransactionInput`（`item`, `amount`, `date`、すべて必須）。
- 両方を満たす = 「`id`, `item`, `amount`, `date` をすべて持つオブジェクト」。

`TransactionInput` を書き直さずに再利用できるので、`item` などの定義を変えたときに `Transaction` にも自動で反映されます。

フロントの型定義は逆向きで、`Transaction` から `id` を除いて送信用の型を作っています。

`web-app/src/hooks/transactions.ts:1-6`, `:21`

```ts
export type Transaction = {
  id: number;
  item: string;
  amount: number;
  date: string;
};

export type NewTransaction = Omit<Transaction, "id">;
```

仕様書は「入力 + id = 登録済み」、フロントは「登録済み − id = 入力」と、方向は違いますが同じ関係を表しています。

## 重要語句

- **`allOf`**: すべてのサブスキーマに一致すること（AND）。
- **`anyOf`**: 1 つ以上のサブスキーマに一致すること（OR）。
- **`oneOf`**: ちょうど 1 つのサブスキーマに一致すること（排他的 OR）。
- **合成（composition）**: 小さなスキーマを組み合わせて大きなスキーマを作ること。

## 仕様・注意点

- **`allOf` は「マージ」ではなく「それぞれで検証して全部 OK か」** です。この違いが問題になるのが `additionalProperties: false` です。
  - もし `TransactionInput` に `additionalProperties: false` を付けると、`Transaction` の値 `{ id, item, amount, date }` を `TransactionInput` 単体で検証したとき、`id` が「未知のプロパティ」として **拒否されてしまいます**。
  - JSON Schema 2020-12（OpenAPI 3.1）では、合成後のスキーマ側に **`unevaluatedProperties: false`** を書くことで、「`allOf` の各サブスキーマのどれでも評価されなかったプロパティを拒否」でき、この問題を回避できます。
- 1 つ目のサブスキーマに `type: object` を書いているのは、`TransactionInput` 側にも `type: object` があるので必須ではありませんが、単体で読んだときに意味が明確になる利点があります。
- ツールによっては `allOf` の表示や型生成の結果が見づらくなることがあります。`openapi-typescript` は交差型（`&`）として生成します。

## 今後に活かせるポイント

- 「作成用」「更新用」「レスポンス用」で少しずつ違うスキーマは、共通部分を切り出して `allOf` で合成すると重複を減らせます。
- 例: 作成日時 `createdAt` をサーバーで付けるようになったら、`Transaction` の 1 つ目のサブスキーマに追加するだけで済みます。

## 改善するなら

### 未知のプロパティを拒否しつつ合成する（3.1 の書き方）

```yaml
TransactionInput:
  type: object
  required: [item, amount, date]
  properties:
    item: { type: string, minLength: 1 }
    amount: { type: number, not: { const: 0 } }
    date: { type: string, format: date }

Transaction:
  allOf:
    - type: object
      required: [id]
      properties:
        id: { type: integer }
    - $ref: "#/components/schemas/TransactionInput"
  unevaluatedProperties: false   # id/item/amount/date 以外を拒否
```

### 別解: `readOnly` で 1 つのスキーマにまとめる

```yaml
Transaction:
  type: object
  required: [id, item, amount, date]
  properties:
    id:
      type: integer
      readOnly: true   # レスポンスにのみ現れる（リクエストでは送らない）
    item: { type: string }
    # ...
```

`readOnly` は 1 つのスキーマで済む反面、`required` との組み合わせの解釈がツールによって異なるため、このプロジェクトのように入力用と出力用を分ける方が分かりやすいことも多いです。

## 次に学ぶこと

- `oneOf` + `discriminator`（例: 収入と支出を別スキーマにして `type` で判別する設計）
- Zod の `.extend()` / `.omit()` / `.pick()` で同じ合成をコード側で行う方法
