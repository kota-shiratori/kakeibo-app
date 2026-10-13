# レスポンス設計: 配列をオブジェクトで包む（ラップ形式）

## 概要

一覧 API のレスポンスには、大きく 2 つのスタイルがあります。

```jsonc
// A: 配列をそのまま返す
[{ "id": 1, "item": "給料", ... }]

// B: オブジェクトで包む（ラップ形式 / エンベロープ）
{ "transactions": [{ "id": 1, ... }], "totalCount": 1, "totalAmount": 10000 }
```

このプロジェクトは B を採用しています。B は **後からフィールドを追加しても既存クライアントを壊さない** のが大きな利点です。

## このプロジェクトでの実装

`backend/src/index.ts:39-48`

```ts
const result = {
  transactions: transactionList,
  totalCount: transactionList.length,
  totalAmount: transactionList.reduce(
    (sum, transaction) => sum + transaction.amount,
    0,
  ),
};

return c.json(result, 200);
```

仕様書: `backend/openapi.yaml:133-151`

```yaml
TransactionListResponse:
  type: object
  required:
    - transactions
    - totalCount
    - totalAmount
  properties:
    transactions:
      type: array
      items:
        $ref: "#/components/schemas/Transaction"
    totalCount:
      type: integer
    totalAmount:
      type: number
```

フロント側の型も同じ形です。

`web-app/src/hooks/transactions.ts:8-12`

```ts
export type TransactionListInfo = {
  transactions: Transaction[];
  totalCount: number;
  totalAmount: number;
};
```

## 重要語句

- **エンベロープ（envelope）/ ラップ形式**: データ本体を、メタ情報と一緒にオブジェクトで包む形。
- **メタ情報**: 件数・合計・ページ情報など、データ本体以外の付加情報。
- **後方互換性**: API を変更しても、古いクライアントがそのまま動き続けること。

## 仕様・注意点

ラップ形式のメリット:

1. **拡張しやすい**: ページネーションを入れるときに `nextCursor` や `hasMore` を足しても、`transactions` を読んでいるクライアントは壊れません。トップレベルが配列だと、構造そのものを変える破壊的変更になります。
2. **集計をサーバーで済ませられる**: `totalAmount` をサーバーで計算しておけば、クライアントごとに計算ロジックを持たずに済みます。ページネーションでデータの一部しか返さない場合、**全体の件数・合計はサーバーしか知らない** ので特に重要です。
3. **自己説明的**: `transactions` というキー名で中身が分かります。

注意点:

- `totalCount` が「返した件数」なのか「条件に合う全件数」なのかは、ページネーション導入時に意味が分かれます。今は同じ値ですが（`transactionList.length`）、仕様書の `description` で定義を明確にしておくとよいでしょう。
- `totalAmount` は収入（正）と支出（負）を合計するので、`type=all` のときは「収支差額」になります。`type` ごとの意味の違いを仕様書に書いておくと親切です。
- 金額を `number`（JavaScript では浮動小数点数）で扱っています。日本円の整数だけなら問題になりにくいですが、小数を含む通貨では誤差に注意が必要です（整数の最小単位で持つ、文字列で持つ等）。

## 今後に活かせるポイント

- 一覧系 API は最初からオブジェクトで包んでおくと、あとで困りません。
- 1 件取得（`GET /transactions/{id}`）は、包まずにリソースそのものを返すのが一般的です。どちらにするか API 全体で方針を決めておきましょう。

## 改善するなら

- `amount` が日本円の整数前提なら、仕様書で `type: integer` にすると意図が明確になります（現在は `type: number`、`backend/openapi.yaml:108`, `:149`）。
- ページネーション導入時のイメージ:

```json
{
  "transactions": [ ... ],
  "totalCount": 120,
  "totalAmount": 53000,
  "nextCursor": "eyJpZCI6MjB9",
  "hasMore": true
}
```

## 次に学ぶこと

- カーソルベースのページネーション設計
- JSON:API など、エンベロープの形を標準化した仕様
