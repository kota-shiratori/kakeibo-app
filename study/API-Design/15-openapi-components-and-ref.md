# OpenAPI: components と $ref による再利用

## 概要

`components` は、仕様書の中で **繰り返し使う部品をまとめておく場所** です。部品は `$ref`（JSON Reference）で参照します。

```yaml
$ref: "#/components/schemas/ErrorResponse"
```

- `#` … 「このファイル自身」
- `/components/schemas/ErrorResponse` … ファイル内の場所（JSON Pointer）

プログラミングでいう「関数や型を定義して使い回す」のと同じ発想で、**同じ定義を 1 か所にまとめ、変更を 1 回で済ませる** ための仕組みです。

## このプロジェクトでの実装

`components` には 3 種類の部品があります。

| 種類 | 行 | 中身 |
| --- | --- | --- |
| `parameters` | `backend/openapi.yaml:79-91` | `TransactionType`（クエリ `type`） |
| `schemas` | `backend/openapi.yaml:93-160` | `TransactionInput`, `Transaction`, `TransactionListResponse`, `ErrorResponse` |
| `examples` | `backend/openapi.yaml:162-178` | `InvalidTypeError`, `MissingFieldsError`, `InvalidAmountError`, `InvalidDateError` |

### 参照の流れ（依存関係）

```
GET /transactions
├─ parameters → #/components/parameters/TransactionType         (:27)
├─ 200 → #/components/schemas/TransactionListResponse            (:34)
│         └─ transactions.items → #/components/schemas/Transaction (:143)
│                                  └─ allOf → #/components/schemas/TransactionInput (:131)
└─ 400 → #/components/schemas/ErrorResponse                      (:40)
          └─ examples.invalidType → #/components/examples/InvalidTypeError (:43)

POST /transactions
├─ requestBody → #/components/schemas/TransactionInput           (:56)
├─ 201 → #/components/schemas/TransactionInput                   (:63)
└─ 400 → #/components/schemas/ErrorResponse                      (:69)
          └─ examples → MissingFieldsError / InvalidAmountError / InvalidDateError (:72, :74, :76)
```

`TransactionInput` は「リクエストボディ」「201 レスポンス」「`Transaction` の一部」の 3 か所から使われています。たとえば `item` に `maxLength: 20` を追加したくなったら、`backend/openapi.yaml:102-106` の 1 か所を直すだけで全部に反映されます。

### examples の再利用

`backend/openapi.yaml:162-166`

```yaml
examples:
  InvalidTypeError:
    summary: typeが不正
    value:
      message: typeはincome,expense,allのいずれかである必要があります。
```

Example Object は `summary`（短い説明）と `value`（実際の値）を持ちます。`value` の `message` は実装のエラーメッセージ（`backend/src/index.ts:24`）と同じ文言で、ドキュメントを読むだけで実際に返る値が分かります。

## 重要語句

- **components**: 再利用可能な部品置き場。`schemas`, `responses`, `parameters`, `examples`, `requestBodies`, `headers`, `securitySchemes`, `links`, `callbacks`, `pathItems` を持てる。
- **`$ref`**: 参照。`#/...` は同一ファイル内、`./schemas/transaction.yaml` のように書けば別ファイルも参照できる。
- **JSON Pointer**: `/components/schemas/Transaction` のように `/` 区切りで JSON 内の位置を表す記法（RFC 6901）。
- **Reference Object**: `$ref` を持つオブジェクト。

## 仕様・注意点

- `components` に定義しただけでは何の効果もありません。どこかから `$ref` で参照されて初めて使われます。
- **Reference Object（パラメータ・レスポンス・例など）では、`$ref` と並べて書けるのは `summary` と `description` だけ** です。それ以外のキーを並べても無視されます。
- 一方、**スキーマ内の `$ref`** は OpenAPI 3.1（JSON Schema 2020-12）では他のキーワードと並べて書け、両方が適用されます（3.0 では `$ref` の兄弟キーは無視されていました）。
- `components` のキー名は `^[a-zA-Z0-9\.\-_]+$` の文字しか使えません（日本語のキー名は不可）。
- コード生成ツールは `components/schemas` のキー名を型名に使うことが多いので、`TransactionInput` のように PascalCase の分かりやすい名前にしておくと、生成された型がそのまま読みやすくなります。

## 今後に活かせるポイント

- 同じ形が 2 回出てきたら `components` に切り出す、を目安にしましょう。
- 仕様書が大きくなったら、`$ref` で別ファイルに分割できます（`paths/transactions.yaml`, `schemas/Transaction.yaml` など）。Redocly CLI の `bundle` で 1 ファイルにまとめ直せます。

## 改善するなら

400 レスポンスが GET と POST でほぼ同じ形なので、`components/responses` にも切り出せます（例は `14-openapi-request-body-responses.md` を参照）。

ファイル分割の例:

```yaml
# openapi.yaml
components:
  schemas:
    Transaction:
      $ref: "./schemas/Transaction.yaml"
```

## 次に学ぶこと

- Redocly CLI の `bundle` / `split` による仕様書のファイル分割と結合
- `openapi-typescript` が `components["schemas"]["Transaction"]` という形で型を生成する仕組み
