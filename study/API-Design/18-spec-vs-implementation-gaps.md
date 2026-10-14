# 仕様（openapi.yaml）と実装（index.ts）の乖離チェック

## 概要

仕様書を手で書き、実装も手で書く方式では、両者が少しずつずれていきます。定期的に「仕様書どおりに動いているか」を突き合わせることが大切です。

このノートは、`backend/openapi.yaml` と `backend/src/index.ts` を 1 行ずつ突き合わせ、さらに **実際にリクエストを送って挙動を確認** した結果をまとめたものです。推測ではなく、確認できたものだけを載せています。

確認方法: 現在の `backend/src/index.ts` を、実験用の DB（ローカルの Docker の PostgreSQL に作った使い捨ての DB。`transactions` テーブルだけを学習メモと同じ定義で作成し、確認後に削除）につなぎ、`app.request()` でリクエストを送りました（`../Hono/15-testing-with-app-request.md`）。

> 以前のバージョン（DB 導入前）では、GET が固定の 1 件を返し、POST が受け取った内容をそのまま返していました。そのころ乖離として挙げていた「GET が `type` で絞り込まない」「POST が保存しない」「余分なプロパティがそのまま返る」は、DB 導入で **解消** しています（→ 下の「解消済みの乖離」）。代わりに、**実装が先に進んで仕様書が取り残された** 乖離が新しく生まれています。

## このプロジェクトでの実装

### 一致している点

| 観点 | 仕様書 | 実装 | 確認 |
| --- | --- | --- | --- |
| `type` が必須 | `required: true`（`openapi.yaml:83`） | `!type` で 400（`index.ts:32`） | 未指定で 400 |
| `type` の許可値 | `enum: [income, expense, all]`（`openapi.yaml:87-90`） | `includes(type)`（`index.ts:32`） | `?type=foo` で 400 |
| `type` の意味 | 「指定した種別の収支一覧と、件数・合計金額を返します。」（`openapi.yaml:25`） | `WHERE amount > 0` / `< 0` を付けて SELECT（`index.ts:44-49`） | `?type=expense` で負の金額の行だけが返った |
| 一覧レスポンスの形 | `transactions`, `totalCount`, `totalAmount`（`openapi.yaml:133-151`） | 同じキー（`index.ts:68-72`） | 200 で一致 |
| 一覧の各要素 | `Transaction`（`id` 付き、`openapi.yaml:120-131`） | DB の行を `{ id, item, amount, date }` に変換（`index.ts:56-61`） | `{"id":2,"item":"ランチ","amount":-1000,"date":"2025-10-01"}` |
| 金額の検証 | `type: number`, `not: { const: 0 }`（`openapi.yaml:107-110`） | `typeof !== "number" \|\| === 0`（`index.ts:85`） | `"100"`（文字列）・`0` で 400 |
| エラーの形 | `ErrorResponse { message }`（`openapi.yaml:153-160`） | すべての 400 が `{ message }` | 一致 |
| エラー文言 | `components/examples`（`openapi.yaml:162-178`） | `index.ts:35`, `:82`, `:86`, `:90` | 4 つとも完全一致 |
| ローカルのサーバー URL | `http://localhost:3000`（`openapi.yaml:8`） | `port: 3000`（`dev.ts:6`） | 一致 |

### 乖離・問題点

#### 1. POST の 201 のスキーマと説明が古い（実装が先に進んだ）

- 仕様: 説明は「収支を1件登録し、受け取った内容をそのまま返します。」（`backend/openapi.yaml:50`）、201 のスキーマは `TransactionInput`（**`id` なし**、`backend/openapi.yaml:63`）。
- 実装: DB に `INSERT ... RETURNING` し、採番された `id` を含む行を返す（`backend/src/index.ts:93-105`）。
- 確認: `{"item":"給料","amount":10000,"date":"2025-10-01"}` を POST すると、201 で `{"id":1,"item":"給料","amount":10000,"date":"2025-10-01"}` が返った。
- 対応: **仕様側を直す**。201 のスキーマを `$ref: "#/components/schemas/Transaction"` にし、説明を「採番されたIDを含む登録内容を返します」に変える（→ `14-openapi-request-body-responses.md`）。

#### 2. `item` の型を検証していない

- 仕様: `type: string`, `minLength: 1`（`backend/openapi.yaml:102-104`）
- 実装: `!item` のみ（`backend/src/index.ts:81`）
- 確認: `"item": 123` が 201 で受け付けられ、DB には文字列 `"123"` として保存された（`true` → `"true"`、`["a"]` → `{"a"}` も同様）。

#### 3. `item` の上限が仕様・実装になく、DB にだけある

- 仕様: 上限なし。実装: 上限なし。フロント: `maxLength={20}`（`web-app/src/pages/Input.tsx:89`）。DB: `VARCHAR(20)`。
- 確認: 21 文字の `item` を送ると、DB が `value too long for type character varying(20)` で拒否し、**500** が返った。

#### 4. `date` の型を検証していない

- 仕様: `type: string`（`backend/openapi.yaml:114`）
- 実装: 正規表現の `test` のみ（`backend/src/index.ts:89`）。`test` は引数を文字列に変換する。
- 確認: `"date": ["2025-01-01"]`（配列）が 201 で受け付けられ、`2025-01-01` として保存された（→ `09-input-validation-rules.md`）。

#### 5. `format: date`（実在する日付）を検証していない

- 仕様: `format: date`（`backend/openapi.yaml:115`）
- 実装: 形式のみ（`backend/src/index.ts:89`）
- 確認: `"date": "2025-13-45"` / `"2025-02-30"` は検証を通過し、DB の `DATE` 型が拒否して **500** が返った（→ `10-date-validation-pitfalls.md`）。以前（DB 導入前）は 201 で受け付けていた。
- 補足: JSON Schema 2020-12 では `format` は既定で注釈扱いなので、厳密には「仕様違反」とは言い切れませんが、意図とはずれています。

#### 6. `amount` は仕様では `number`、DB では `INTEGER`

- 仕様: `type: number`（小数も可、上限なし、`backend/openapi.yaml:108`）。
- 確認: `1.5`、`2147483648`、`1e300`、`1e400`（`JSON.parse` で `Infinity`）は検証を通過し、DB の `INTEGER` が拒否して **500** が返った。
- 対応: 仕様を `type: integer`（必要なら `minimum` / `maximum`）にし、実装も `Number.isInteger` などで検証して 400 にする（`../Database/03-schema-design-for-kakeibo.md`）。

#### 7. 仕様にない 500（text/plain）が返る

- 仕様: GET/POST とも 200/201 と 400 のみ定義。
- 実装: 次のときに `content-type: text/plain` で `Internal Server Error`（500）が返る（Hono 既定のエラーハンドラ、`backend/node_modules/hono/dist/hono-base.js:14-21`）。
  - 壊れた JSON（`{bad`）や JSON の `null` を送ったとき
  - 上の 3・5・6 のように、検証を通過した値を DB が拒否したとき（`../PostgreSQL/05-constraints-and-errors.md`）
  - DB に接続できないとき（`DATABASE_URL` のポート違いで `ECONNREFUSED` を確認）
- クライアントの誤りによるものは `ErrorResponse` 形式の 400 を返すべきです。DB 接続失敗のような本当のサーバー側の障害は 500 で正しいですが、仕様書に `500`（または `default`）を書き、形も `ErrorResponse` に揃えるとよいでしょう。

#### 8. `application/json` 以外のボディも受け付ける

- 仕様: `requestBody.content` は `application/json` のみ（`backend/openapi.yaml:53-54`）。
- 実装: `c.req.json()` は Content-Type を見ない（`backend/node_modules/hono/dist/request.js:104-106`）。
- 確認: `Content-Type: text/plain` で JSON 文字列を送ると、検証を通過して **DB に保存され、201 が返った**（→ `07-json-and-content-type.md`、`21-cors-credentials-and-hono-config.md`）。

#### 9. 本番のサーバー URL が仕様書にない

- 仕様: `servers` は `http://localhost:3000` のみ（`backend/openapi.yaml:7-9`）。
- 実装: backend は Vercel Functions でも動く構成になっている（`backend/src/index.ts:108` の `export default app` を Vercel が使い、ローカルは `backend/src/dev.ts`）。
- 本番 URL を `servers` に追加するとよい（URL はこのノートでは未確認）。

### 解消済みの乖離（DB 導入前に挙げていたもの）

| 以前の乖離 | 現在 |
| --- | --- |
| GET の `type` を受け取るが絞り込まない（支出一覧に「給料」が出た） | `WHERE amount > 0` / `< 0` で絞り込む（`index.ts:44-49`）。`?type=expense` で負の金額だけが返ることを確認 |
| POST が保存しない（登録しても一覧に出ない） | `INSERT` で保存（`index.ts:93-96`）。登録後の `?type=all` に含まれることを確認 |
| 余分なプロパティ（`extra`）がそのまま 201 のレスポンスに含まれる | `item` / `amount` / `date` だけを INSERT し、DB の行から返す。`"extra"` や `"id": 999` を送っても、レスポンスには含まれず `id` は DB が採番した値だった |

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

当面の手修正としては、まず仕様書を実装に追いつかせます（乖離 1, 6, 7）。

```yaml
# openapi.yaml（POST の部分）
description: 収支を1件登録し、採番されたIDを含む登録内容を返します。
responses:
  "201":
    description: 登録成功
    content:
      application/json:
        schema:
          $ref: "#/components/schemas/Transaction"
  "400": ...
  "500":
    description: サーバー内部のエラー（DB 接続失敗など）
    content:
      application/json:
        schema:
          $ref: "#/components/schemas/ErrorResponse"
```

そのうえで実装側の検証を DB の型・制約に揃え（`item` は 1〜20 文字の文字列、`amount` は 0 以外の整数、`date` は実在する日付）、DB エラー由来の 500 をなくします（→ `09-input-validation-rules.md`）。

## 次に学ぶこと

- `@hono/zod-openapi` によるコードからの仕様生成
- Schemathesis など、仕様書からテストケースを自動生成して実装を叩くツール
