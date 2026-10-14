# `c.json(body, status)` で JSON レスポンスを返す

## 概要

`c.json()` は、JavaScript の値を `JSON.stringify` し、`Content-Type: application/json` を付けた `Response` を作るヘルパーです。第 2 引数でステータスコードを指定できます。REST API で最もよく使う出力方法です。

ステータスコードの「どれを使うべきか」という設計論は `study/API-Design` の担当です。ここでは **Hono での書き方** に絞ります。

## このプロジェクトでの実装

| 行 | コード | 意味 |
| --- | --- | --- |
| `backend/src/index.ts:33-38` | `c.json({ message: "typeは..." }, 400)` | クエリ不正 |
| `backend/src/index.ts:74` | `c.json(result, 200)` | 一覧取得成功 |
| `backend/src/index.ts:82` | `c.json({ message: "必須項目が不足しています。" }, 400)` | 必須項目なし |
| `backend/src/index.ts:86` | `c.json({ message: "金額は0以外..." }, 400)` | 金額不正 |
| `backend/src/index.ts:90` | `c.json({ message: "日付は..." }, 400)` | 日付形式不正 |
| `backend/src/index.ts:105` | `c.json(newTransaction, 201)` | 登録成功（作成）。DB の `RETURNING` で受け取った行を返す |

201 で返す `newTransaction` は、リクエストボディではなく **DB に実際に保存された行** から組み立てています（`backend/src/index.ts:93-103`）。

```ts
const result = await pool.query(
  `INSERT INTO transactions (item, amount, date) VALUES ($1, $2, $3) RETURNING id, item, amount, date`,
  [item, amount, date],
);

const newTransaction = {
  id: parseInt(result.rows[0].id),
  item: result.rows[0].item,
  amount: parseFloat(result.rows[0].amount),
  date: toYMD(new Date(result.rows[0].date)),
};
```

実験で `{ "item": "ランチ", "amount": -1000, "date": "2025-10-10", "isAdmin": true }` を POST すると、レスポンスは `{"id":3,"item":"ランチ","amount":-1000,"date":"2025-10-10"}` で、DB が採番した `id` が付き、余計な `isAdmin` は返りませんでした。

エラー時は `{ message: string }` という共通の形で返しているので、フロントエンドは同じ方法でエラー文言を取り出せます。

## 重要語句

| 用語 | 意味 |
| --- | --- |
| `c.json(object, status?, headers?)` | JSON レスポンスを作る。status 省略時は 200 |
| `c.json(object, init?)` | 第 2 引数に `{ status, headers }` のような `ResponseInit` も渡せる |
| `ContentfulStatusCode` | ボディを持てるステータスコードの型。`c.json` の status はこの型に制限される |
| `c.status(code)` | 以降に作るレスポンスのステータスを先に設定する |
| `c.text()` / `c.html()` / `c.body()` | テキスト / HTML / 任意ボディのレスポンス |

## 仕様・注意点

- 型定義（`node_modules/hono/dist/types/context.d.ts` の `JSONRespond`）:

  ```ts
  <T extends JSONValue | {} | InvalidJSONValue, U extends ContentfulStatusCode = ContentfulStatusCode>
    (object: T, status?: U, headers?: HeaderRecord): JSONRespondReturn<T, U>;
  <T ..., U ...>(object: T, init?: ResponseOrInit<U>): JSONRespondReturn<T, U>;
  ```

  - status は `ContentfulStatusCode` なので、**ボディを持てない 204 や 304 などは型エラー** になります。204 を返したいときは `c.body(null, 204)` を使います。
  - 戻り値は `Response & TypedResponse<...>`。**ボディの型とステータスコードの組み合わせ** が型として残るため、RPC クライアントで `res.status === 201` のように分岐すると、ボディの型が絞り込まれます。だから `c.json(result, 200)` のように **ステータスを明示しておく価値** があります。
- 実装は `this.#newResponse(JSON.stringify(object), arg, setDefaultContentType("application/json", headers))`。つまり **`JSON.stringify` で表現できない値は変換される/消える** 点に注意（`undefined` のプロパティは消える、`Date` は ISO 文字列になる、`BigInt` は例外）。
  - このプロジェクトでは `pg` が `DATE` 列を JS の `Date` で返すため、行をそのまま `c.json` すると `"2025-10-04T15:00:00.000Z"`（日本時間の 0 時を UTC で表した文字列）のような値になります。`toYMD` で `YYYY-MM-DD` に変換してから返しているのはそのためです（`../PostgreSQL/07-node-postgres-type-conversion.md`）。
- 実験で確認したレスポンスヘッダは `content-type: application/json`（charset なし）。
- 既定の 404 / 500 は `c.text()` で返されるため **JSON ではなく text/plain**（実験では `text/plain; charset=UTF-8`）です。フロントで常に `response.json()` すると失敗するので注意（→ 10 章）。

## 今後に活かせるポイント

- エラーレスポンスの形を統一する（`{ message }` や `{ error: { code, message } }`）と、フロントの共通処理が書きやすくなります。
- 成功時もステータスを明示する書き方（`c.json(x, 200)`）は、RPC の型推論で効いてきます。

## 改善するなら

1. 同じ形のエラーレスポンスを何度も書いているので、小さなヘルパーにまとめられます。
2. 行 → レスポンスの変換（`parseInt` / `toYMD`）が GET（56-61 行目）と POST（98-103 行目）に重複しているので、1 つの関数にまとめます。`amount` は `INTEGER` 列で最初から number なので `parseFloat` は不要です（`../PostgreSQL/07-node-postgres-type-conversion.md`）。
3. OpenAPI の 201 のスキーマは `TransactionInput`（`id` なし）のままなので、実装に合わせて `Transaction` に直します（`backend/openapi.yaml:58-63`）。

（以前は POST が受け取った `body` をそのまま 201 で返していましたが、DB 導入時に `RETURNING` の行を返す形に改善済みです。）

```ts
const badRequest = (c: Context, message: string) => c.json({ message }, 400);

app.post("/transactions", async (c) => {
  // ...検証...
  if (!item || amount === undefined || !date) {
    return badRequest(c, "必須項目が不足しています。");
  }
  const result = await pool.query(
    `INSERT INTO transactions (item, amount, date) VALUES ($1, $2, $3) RETURNING id, item, amount, date`,
    [item, amount, date],
  );
  return c.json(toTransaction(result.rows[0]), 201); // 変換は 1 か所に集約
});
```

（`Context` は `import type { Context } from "hono"` で取り込みます。）

## 次に学ぶこと

- `c.body(null, 204)` やリダイレクト（`c.redirect(url, 302)`）
- `hono/utils/http-status` の型（`StatusCode`, `ContentfulStatusCode`, `ContentlessStatusCode = 101 | 204 | 205 | 304` など）
- Hono RPC（`hc`）で `TypedResponse` がどう使われるか
- ステータスコードの使い分けは `study/API-Design` を参照
