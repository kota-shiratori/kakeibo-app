# 仕様（openapi.yaml）と実装（index.ts）の乖離チェック

## 概要

仕様書を手で書き、実装も手で書く方式では、両者が少しずつずれていきます。定期的に「仕様書どおりに動いているか」を突き合わせることが大切です。

このノートは、`backend/openapi.yaml` と `backend/src/index.ts` を 1 行ずつ突き合わせ、さらに **起動中のサーバーに curl でリクエストを送って実際の挙動を確認** した結果をまとめたものです。推測ではなく、確認できたものだけを載せています。

## このプロジェクトでの実装

### 一致している点

| 観点 | 仕様書 | 実装 | 確認 |
| --- | --- | --- | --- |
| `type` が必須 | `required: true`（`openapi.yaml:83`） | `!type` で 400（`index.ts:21`） | 未指定で 400 |
| `type` の許可値 | `enum: [income, expense, all]`（`openapi.yaml:87-90`） | `includes(type)`（`index.ts:21`） | `?type=foo` で 400 |
| 一覧レスポンスの形 | `transactions`, `totalCount`, `totalAmount`（`openapi.yaml:133-151`） | 同じキー（`index.ts:39-46`） | 200 で一致 |
| 金額の検証 | `type: number`, `not: { const: 0 }`（`openapi.yaml:107-110`） | `typeof !== "number" \|\| === 0`（`index.ts:65`） | `"100"`（文字列）で 400 |
| エラーの形 | `ErrorResponse { message }`（`openapi.yaml:153-160`） | すべての 400 が `{ message }` | 一致 |
| エラー文言 | `components/examples`（`openapi.yaml:162-178`） | `index.ts:24`, `:59`, `:68`, `:77` | 4 つとも完全一致 |
| POST の 201 と内容 | 「受け取った内容をそのまま返します」、スキーマ `TransactionInput`（`openapi.yaml:50`, `:58-63`） | `return c.json(body, 201)`（`index.ts:83`） | 一致 |
| サーバー URL | `http://localhost:3000`（`openapi.yaml:8`） | `port: 3000`（`index.ts:89`） | 一致 |

### 乖離・問題点

#### 1. GET の `type` を受け取るが、絞り込みをしていない

- 仕様: 「指定した種別の収支一覧と、件数・合計金額を返します。」（`backend/openapi.yaml:25`）
- 実装: `type` は検証だけに使われ、その後は固定の配列を返す（`backend/src/index.ts:30-37`）。
- 確認: `GET /transactions?type=expense` で `{"transactions":[{"id":1,"item":"給料","amount":10000,...}],...}` が返った。
- 影響: フロントの支出一覧（`web-app/src/hooks/useExpenseTransactions.ts:15`）にも収入の「給料」が表示される。

#### 2. POST が保存しない（作成したはずのデータが一覧に出ない）

- 仕様の説明は「収支を1件登録し」（`backend/openapi.yaml:50`）。
- 実装は受け取った値を返すだけで、どこにも保存していない（`backend/src/index.ts:83`）。一覧は固定データ（`:30-37`）なので、登録しても反映されない。
- 学習の途中段階として意図的なものと考えられますが、仕様書の「登録し」という表現とはずれています。

#### 3. 201 のレスポンスに `id` がない

- 仕様: 201 のスキーマは `TransactionInput`（`backend/openapi.yaml:63`）。実装もそのとおり。
- 仕様と実装は一致していますが、**REST の設計としては** 作成されたリソース（`Transaction`、`id` 付き）を返すのが一般的です。保存処理を実装するときに、仕様・実装の両方を `Transaction` に変更するのがよいでしょう。

#### 4. `item` の型を検証していない

- 仕様: `type: string`, `minLength: 1`（`backend/openapi.yaml:102-104`）
- 実装: `!item` のみ（`backend/src/index.ts:56`）
- 確認: `"item": 123` が 201 で受け付けられた。

#### 5. `date` の型を検証していない

- 仕様: `type: string`（`backend/openapi.yaml:114`）
- 実装: 正規表現の `test` のみ（`backend/src/index.ts:74`）。`test` は引数を文字列に変換する。
- 確認: `"date": ["2025-01-01"]`（配列）が 201 で受け付けられた。

#### 6. `format: date`（実在する日付）を検証していない

- 仕様: `format: date`（`backend/openapi.yaml:115`）
- 実装: 形式のみ（`backend/src/index.ts:74`）
- 確認: `"date": "2025-13-45"` が 201 で受け付けられた（→ `10-date-validation-pitfalls.md`）。
- 補足: JSON Schema 2020-12 では `format` は既定で注釈扱いなので、厳密には「仕様違反」とは言い切れませんが、意図とはずれています。

#### 7. 仕様にない 500（text/plain）が返る

- 仕様: GET/POST とも 200/201 と 400 のみ定義。
- 実装: 壊れた JSON（`{bad`）や JSON の `null` を送ると、`content-type: text/plain` で `Internal Server Error`（500）が返る（Hono 既定のエラーハンドラ、`backend/node_modules/hono/dist/hono-base.js:14-21`）。
- 本来はクライアントの誤りなので、`ErrorResponse` 形式の 400 を返すべきです。

#### 8. `application/json` 以外のボディも受け付ける

- 仕様: `requestBody.content` は `application/json` のみ（`backend/openapi.yaml:53-54`）。
- 実装: `c.req.json()` は Content-Type を見ない（`backend/node_modules/hono/dist/request.js:104-106`）。
- 確認: `Content-Type: text/plain` で JSON 文字列を送ると、JSON として検証が進んだ。

#### 9. 余分なプロパティがそのまま返る

- 確認: `"extra": "x"` を付けて POST すると、201 のレスポンスにも `extra` が含まれた。
- `TransactionInput` は `additionalProperties` を制限していないため **仕様違反ではありません** が、保存処理を書くときに body をそのまま DB に渡すと危険です。

## 重要語句

- **乖離（ドリフト）**: 仕様書と実装がずれること。
- **契約テスト（contract test）**: 実装が仕様書どおりのリクエスト・レスポンスになっているかを自動で確かめるテスト。
- **Single Source of Truth**: 「正」とする情報源を 1 つに決めること。

## 仕様・注意点

- 仕様書と実装の **どちらを正とするか** を決めておかないと、ずれを見つけても「どちらを直すか」で迷います。
- 乖離チェックは「正常系」より「異常系（変な値・壊れた JSON・型違い）」で見つかることが多いです。

## 今後に活かせるポイント

- 変更の際は「実装を直したら仕様書も直す」を 1 つのコミットで行う習慣をつけましょう。
- curl や HTTP クライアント（VS Code の REST Client、Bruno など）で異常系のリクエストを保存しておくと、回帰確認に使えます。

## 改善するなら

乖離を構造的に防ぐ方法は大きく 2 つです。

1. **コードファースト**: `@hono/zod-openapi` で Zod スキーマとルートを定義し、そこから仕様書を生成する。実装と仕様書が同じ定義から作られるので、ずれようがない。
2. **スキーマファースト + 検証**: 仕様書を正とし、リクエスト・レスポンスを仕様書で検証するミドルウェアやテストを用意する。

当面の手修正としては、GET で `type` による絞り込みを実装します（収入は正、支出は負の金額という前提、`web-app/src/pages/Input.tsx:32-36`）。

```ts
const filtered = transactionList.filter((t) => {
  if (type === "income") return t.amount > 0;
  if (type === "expense") return t.amount < 0;
  return true; // all
});

const result = {
  transactions: filtered,
  totalCount: filtered.length,
  totalAmount: filtered.reduce((sum, t) => sum + t.amount, 0),
};
```

## 次に学ぶこと

- `@hono/zod-openapi` によるコードからの仕様生成
- Schemathesis など、仕様書からテストケースを自動生成して実装を叩くツール
