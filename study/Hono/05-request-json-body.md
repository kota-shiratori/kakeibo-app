# JSON ボディの取得 `c.req.json()`

## 概要

POST や PUT で送られてくるデータ（リクエストボディ）は、`await c.req.json()` で JavaScript のオブジェクトとして受け取れます。ボディの読み取りは非同期（ストリームを読み切る必要がある）なので、Promise を返します。

## このプロジェクトでの実装

フロントエンド側の送信: `web-app/src/hooks/useAddTransactions.ts:14-18`

```ts
const response = await fetch(`${BASE_URL}/transactions`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(transaction),
});
```

バックエンド側の受信: `backend/src/index.ts:77-79`

```ts
app.post("/transactions", async (c) => {
  const body = await c.req.json();
  const { item, amount, date } = body;
```

- 77 行目: `await` を使うのでハンドラを `async` にしている
- 78 行目: ボディを JSON としてパース
- 79 行目: 分割代入で 3 項目を取り出す

取り出した値は検証（81-91 行目）のあと、`pool.query` のプレースホルダー `$1, $2, $3` に渡されて DB に INSERT されます（93-96 行目、`../SQL/11-placeholders-and-sql-injection.md`）。

## 重要語句

| 用語 | 意味 |
| --- | --- |
| `c.req.json<T = any>()` | ボディを `JSON.parse` した結果を返す。型引数を省略すると `any` |
| `c.req.text()` | ボディを文字列で取得 |
| `c.req.parseBody()` | `multipart/form-data` / `application/x-www-form-urlencoded` をパース |
| ボディキャッシュ | Hono は読み取ったボディをキャッシュし、`json()` を複数回呼んでもエラーにならないようにしている |

## 仕様・注意点

実装（`node_modules/hono/dist/request.js`）は次の 1 行です。

```js
json() {
  return this.#cachedBody("text").then((text) => JSON.parse(text));
}
```

ここから分かること・実験で確認したこと（現在の `index.ts` を `app.request()` で呼び出して確認。DB は使い捨てのデータベースを使用）:

1. **戻り値の型は `any`**（`json<T = any>(): Promise<T>`）。`body.item` などに型チェックが一切効きません。`c.req.json<{ item: string }>()` と書いても **実行時の検証は行われず**、型を「信じ込ませる」だけです。
2. **Content-Type をチェックしない**。ヘッダが `text/plain` でも中身が JSON 文字列ならパースされます。実際に `Content-Type: text/plain` で正しい JSON を POST すると、そのまま **201 で DB に登録** されました。
3. **不正な JSON は例外**。`{bad` を送ると `JSON.parse` が `SyntaxError` を投げ、ハンドラ内で捕まえていないため Hono の既定エラーハンドラが **500 `Internal Server Error`（text/plain）** を返しました。本来はクライアントのミスなので 400 が適切です。
4. **`null` を送ると分割代入で落ちる**。ボディ `null` は正しい JSON なのでパースは成功しますが、79 行目の `const { item, amount, date } = body` で `TypeError: Cannot destructure property 'item' of 'body' as it is null.` となり、同じく **500** になりました。
5. **`any` のまま DB に渡る**。`{ "item": 123, "amount": 1, "date": "2025-10-10" }` は検証（`!item` など）を通過し、`pg` が数値 `123` を文字列 `"123"` として送るので、DB には `item = '123'` として **201 で登録** されました。型の検証をしていないと、意図しない値が黙って保存されます。
6. ボディは一度しか読めないストリームですが、Hono の `HonoRequest` はキャッシュするので `c.req.json()` を複数回呼んでも大丈夫です（ただし `c.req.raw.json()` を直接呼ぶとキャッシュを経由しません）。

## 今後に活かせるポイント

- 外部から来るデータは **`unknown` として受けて検証してから使う** のが安全です。

```ts
const body: unknown = await c.req.json().catch(() => undefined);
if (typeof body !== "object" || body === null) {
  return c.json({ message: "JSONオブジェクトを送信してください。" }, 400);
}
```

## 改善するなら

不正 JSON を 400 にする最小修正と、スキーマバリデーションを使う本格的な修正の 2 案です。

```ts
// 案1: 最小修正（try/catch）
app.post("/transactions", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ message: "JSONの形式が不正です。" }, 400);
  }
  if (typeof body !== "object" || body === null) {
    return c.json({ message: "リクエストボディが不正です。" }, 400);
  }
  // ...
});
```

```ts
// 案2: Hono 組み込み validator('json', ...) を使う（hono/validator）
// node_modules/hono/dist/validator/validator.js で確認した挙動:
// - Content-Type が application/json 系なら c.req.json() でパース
//   - JSON が壊れていれば HTTPException(400, "Malformed JSON in request body") を投げる
//     → 既定のエラーハンドラが 400 レスポンスに変換する
// - Content-Type が JSON でない（または無い）場合はパースせず value = {} のまま検証関数へ
//   （400 にはならない。検証関数側で必須項目チェックが必要）
import { validator } from "hono/validator";

app.post(
  "/transactions",
  validator("json", (value, c) => {
    // value を検証し、OK なら返す / NG なら c.json(..., 400) を返す
    return value;
  }),
  (c) => {
    const body = c.req.valid("json");
    // ... pool.query("INSERT ... RETURNING ...", [body.item, body.amount, body.date])
    return c.json(created, 201);
  },
);
```

## 次に学ぶこと

- `hono/validator` と `@hono/zod-validator` の `json` ターゲット（→ 11 章）
- `bodyLimit` ミドルウェア（`hono/body-limit`）で巨大ボディを拒否する
- `c.req.parseBody()` によるフォーム・ファイルアップロード
