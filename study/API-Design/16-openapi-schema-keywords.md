# OpenAPI: スキーマのキーワード（type・required・enum・not/const・format・pattern）

## 概要

OpenAPI 3.1 の Schema Object は JSON Schema（Draft 2020-12）そのものです。このプロジェクトで使っている主なキーワードを整理します。

| キーワード | 意味 | 例 |
| --- | --- | --- |
| `type` | 値の型 | `string`, `number`, `integer`, `boolean`, `object`, `array`, `null` |
| `properties` | オブジェクトの各プロパティのスキーマ | `item`, `amount`, `date` |
| `required` | 必須プロパティ名の配列 | `[item, amount, date]` |
| `items` | 配列の要素のスキーマ | `items: { $ref: Transaction }` |
| `enum` | 許可する値の列挙 | `[income, expense, all]` |
| `const` | 値がこれと等しいこと | `const: 0` |
| `not` | 中のスキーマに **一致しない** こと | `not: { const: 0 }` |
| `minLength` | 文字列の最小長 | `minLength: 1` |
| `pattern` | 正規表現にマッチすること | `^\d{4}-\d{2}-\d{2}$` |
| `format` | 意味的な形式 | `date`, `date-time`, `email`, `uri` |
| `description` / `example` | 説明 / 例（検証には影響しない） | |

## このプロジェクトでの実装

### TransactionInput — `backend/openapi.yaml:94-118`

```yaml
TransactionInput:
  type: object
  description: 収支の登録内容
  required:
    - item
    - amount
    - date
  properties:
    item:
      type: string
      minLength: 1
      description: 項目名
      example: 給料
    amount:
      type: number
      not:
        const: 0
      description: 金額（0以外の数値）
      example: 10000
    date:
      type: string
      format: date
      pattern: "^\\d{4}-\\d{2}-\\d{2}$"
      description: 日付（YYYY-MM-DD形式）
      example: "2025-01-01"
```

ポイント:

- **`required` はオブジェクト側に配列で書く**（`backend/openapi.yaml:97-100`）。プロパティの中に `required: true` と書くのではありません（それはパラメータの書き方）。
- **`minLength: 1`**（`:104`）で空文字を禁止。実装の `!item` に対応。
- **`not: { const: 0 }`**（`:109-110`）で「0 以外」を表現。実装の `amount === 0` チェックに対応。`const` は OpenAPI 3.1 で使えるようになったキーワードです（3.0 では使えません）。
- **`format: date` と `pattern`** を併用（`:115-116`）。詳細は `10-date-validation-pitfalls.md`。
- `pattern` は YAML のダブルクォート文字列内なので、バックスラッシュを `\\d` とエスケープしています（シングルクォート `'^\d{4}-\d{2}-\d{2}$'` ならエスケープ不要）。

### enum — `backend/openapi.yaml:85-90`

```yaml
schema:
  type: string
  enum:
    - income
    - expense
    - all
```

### type: integer と number — `backend/openapi.yaml:127-128`, `:107-108`, `:144-151`

- `id`, `totalCount` は `integer`（整数）。
- `amount`, `totalAmount` は `number`（小数も含む数値）。

## 重要語句

- **JSON Schema 2020-12**: OpenAPI 3.1 が採用している JSON Schema のバージョン。
- **アサーション（assertion）**: 検証に使われるキーワード（`type`, `required`, `pattern` など）。
- **アノテーション（annotation）**: 情報を付け加えるだけのキーワード（`description`, `example`, 既定では `format` も）。

## 仕様・注意点

- **`required` に書かないプロパティは省略可能**、**`properties` に書いていないプロパティも既定では許可** されます（`additionalProperties` の既定は「何でも可」）。このファイルでは追加プロパティを禁止していないので、`{"item":"x","amount":5,"date":"2025-10-02","extra":"y"}` のようなリクエストも仕様上は違反になりません。実装は `item` / `amount` / `date` だけを取り出して INSERT し、DB から返った行でレスポンスを組み立てるので（`backend/src/index.ts:79`, `:93-105`）、余分なプロパティは保存もされず、レスポンスにも含まれません（実験で確認）。
- `type: integer` は「小数部が 0 の数値」です。JSON Schema では `1.0` も integer とみなされます。
- `enum` の値は `type` とも一致している必要があります（`type: string` なら文字列のみ）。
- `pattern` は ECMA-262（JavaScript）の正規表現方言で解釈されるのが基本で、**暗黙に `^...$` で囲まれるわけではありません**。全体一致させたいなら自分で `^` と `$` を書く必要があります（このファイルは書いています）。
- **Schema Object の `example` キーワードは OpenAPI 3.1 で非推奨（deprecated）** になり、JSON Schema 標準の `examples`（配列）を使うことが推奨されています。このファイルの `item.example`（`:106`）などは動作上問題ありませんが、新しく書くなら `examples: [給料]` の形が推奨です。なお、**Parameter Object の `example`**（`:91`）や Media Type Object の `example` は非推奨ではありません。
- 金額を `number` にしているので、仕様上は `0.5` のような小数も許可されます。しかし DB の `amount` 列は `INTEGER` なので、実際に `1.5` を送ると DB がエラーにして 500 が返ります（実験で確認 → `09-input-validation-rules.md`）。日本円の整数のみを想定し、DB とも揃えるなら `integer` が適切です。

## 今後に活かせるポイント

- よく使う追加キーワード:
  - 文字列: `maxLength`, `pattern`, `format`
  - 数値: `minimum`, `maximum`, `exclusiveMinimum`, `multipleOf`
  - 配列: `minItems`, `maxItems`, `uniqueItems`
  - null 許容: 3.1 では `type: [string, "null"]`（3.0 の `nullable: true` は廃止）
- サーバーが付与する値（`id` など）には `readOnly: true` を付ける方法もあります（→ `17-openapi-allof-composition.md`）。

## 改善するなら

フロントの制限（20 文字、`web-app/src/pages/Input.tsx:89`）と DB の列定義（`item VARCHAR(20)`、`amount INTEGER` → `../Database/03-schema-design-for-kakeibo.md`）を仕様書に反映し、`examples` に書き換える例です。

```yaml
TransactionInput:
  type: object
  required: [item, amount, date]
  additionalProperties: false   # 未知のプロパティを拒否
  properties:
    item:
      type: string
      minLength: 1
      maxLength: 20
      examples: [給料]
    amount:
      type: integer
      not:
        const: 0
      examples: [10000, -500]
    date:
      type: string
      format: date
      pattern: '^\d{4}-\d{2}-\d{2}$'
      examples: ["2025-01-01"]
```

※ `additionalProperties: false` を付けると、`allOf` で合成している `Transaction` が壊れる点に注意（→ `17-openapi-allof-composition.md`）。

## 次に学ぶこと

- `oneOf` / `anyOf` / `discriminator` による「複数の形のどれか」の表現
- JSON Schema から Zod スキーマを生成する、あるいは逆に Zod から JSON Schema を生成する（Zod 4 の `z.toJSONSchema()`）
