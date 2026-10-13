# `c.json(body, status)` で JSON レスポンスを返す

## 概要

`c.json()` は、JavaScript の値を `JSON.stringify` し、`Content-Type: application/json` を付けた `Response` を作るヘルパーです。第 2 引数でステータスコードを指定できます。REST API で最もよく使う出力方法です。

ステータスコードの「どれを使うべきか」という設計論は `study/API-Design` の担当です。ここでは **Hono での書き方** に絞ります。

## このプロジェクトでの実装

| 行 | コード | 意味 |
| --- | --- | --- |
| `backend/src/index.ts:22-27` | `c.json({ message: "type は..." }, 400)` | クエリ不正 |
| `backend/src/index.ts:48` | `c.json(result, 200)` | 一覧取得成功 |
| `backend/src/index.ts:57-62` | `c.json({ message: "必須項目が不足しています。" }, 400)` | 必須項目なし |
| `backend/src/index.ts:66-71` | `c.json({ message: "金額は0以外..." }, 400)` | 金額不正 |
| `backend/src/index.ts:75-80` | `c.json({ message: "日付は..." }, 400)` | 日付形式不正 |
| `backend/src/index.ts:83` | `c.json(body, 201)` | 登録成功（作成） |

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
- 実験で確認したレスポンスヘッダは `content-type: application/json`（charset なし）。
- 既定の 404 / 500 は `c.text()` で返されるため **JSON ではなく text/plain** です。フロントで常に `response.json()` すると失敗するので注意（→ 10 章）。

## 今後に活かせるポイント

- エラーレスポンスの形を統一する（`{ message }` や `{ error: { code, message } }`）と、フロントの共通処理が書きやすくなります。
- 成功時もステータスを明示する書き方（`c.json(x, 200)`）は、RPC の型推論で効いてきます。

## 改善するなら

1. **POST の 201 で `body` をそのまま返している**（83 行目）ため、クライアントが送った余計なフィールドもエコーされます。サーバーが採番した `id` も含まれていません。検証済みの値から明示的に組み立てるべきです。
2. 同じ形のエラーレスポンスを何度も書いているので、小さなヘルパーにまとめられます。

```ts
const badRequest = (c: Context, message: string) => c.json({ message }, 400);

app.post("/transactions", async (c) => {
  // ...検証...
  if (!item || amount === undefined || !date) {
    return badRequest(c, "必須項目が不足しています。");
  }
  const created = { id: nextId++, item, amount, date }; // 必要な項目だけで組み立てる
  return c.json(created, 201);
});
```

（`Context` は `import type { Context } from "hono"` で取り込みます。）

## 次に学ぶこと

- `c.body(null, 204)` やリダイレクト（`c.redirect(url, 302)`）
- `hono/utils/http-status` の型（`StatusCode`, `ContentfulStatusCode`, `ContentlessStatusCode = 101 | 204 | 205 | 304` など）
- Hono RPC（`hc`）で `TypedResponse` がどう使われるか
- ステータスコードの使い分けは `study/API-Design` を参照
