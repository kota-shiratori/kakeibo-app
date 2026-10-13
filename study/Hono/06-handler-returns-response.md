# ハンドラは Response を返す（async ハンドラ）

## 概要

Hono のハンドラの基本ルールはただ 1 つ、**「Context を受け取り、`Response` を返す」** です。

```ts
(c) => Response | Promise<Response>
```

Express のように `res.send()` を「呼ぶ」のではなく、`Response` を「返す（return する）」のが特徴です。`c.json()` や `c.text()` は、その `Response` を簡単に作るためのヘルパーです。

ハンドラ内で `await`（ボディの読み取り、DB アクセス、外部 API 呼び出しなど）を使いたい場合は `async` 関数にします。async 関数は `Promise<Response>` を返し、Hono はそれを待ってからクライアントに返します。

## このプロジェクトでの実装

`backend/src/index.ts:18`（GET）と `backend/src/index.ts:51`（POST）は、どちらも `async` で書かれています。

```ts
app.get("/transactions", async (c) => {
  const type = c.req.query("type");
  if (!type || ...) {
    return c.json({ message: "..." }, 400); // 早期 return
  }
  // ...
  return c.json(result, 200);               // 正常系の return
});
```

```ts
app.post("/transactions", async (c) => {
  const body = await c.req.json();          // ← ここで await が必要なので async が必須
  // ...
  return c.json(body, 201);
});
```

- GET ハンドラは中で `await` を使っていないので、`async` は無くても動きます（将来 DB アクセスを足す前提と考えれば問題ありません）。
- POST ハンドラは `await c.req.json()` があるため `async` が必須です。
- どちらも **エラー時は早期 return**（ガード節）で `Response` を返し、最後に正常系の `Response` を返す構造です。

## 重要語句

| 用語 | 意味 |
| --- | --- |
| `Response` | Web 標準のレスポンスオブジェクト。ステータス・ヘッダ・ボディを持つ |
| `new Response(body, init)` | 素の作り方。`c.json()` 等は内部でこれを作っている |
| async ハンドラ | `async (c) => {...}`。`Promise<Response>` を返す |
| 早期 return（ガード節） | 異常系を先に `return` して処理を打ち切る書き方 |
| `TypedResponse` | `c.json()` の戻り値に付く型情報。RPC でクライアントに型を伝えるのに使われる |

## 仕様・注意点

**return を忘れるとどうなるか**（実験で確認、Hono 4.13.13）:

- ミドルウェアが無く、ハンドラだけがマッチする場合 → **404 Not Found** になる（`#dispatch` の高速パスで、戻り値が無ければ notFound ハンドラが呼ばれる）
- このプロジェクトのように **ミドルウェア（cors）がある場合** → `Error: Context is not finalized. Did you forget to return a Response object or \`await next()\`?` が投げられ、既定エラーハンドラにより **500** になる

つまり「`c.json(...)` を書いたのに `return` を付け忘れた」というミスは、環境によって 404 にも 500 にもなり、原因が分かりにくいです。**`c.json` の前には必ず `return`** を付ける習慣をつけましょう。

その他:

- ハンドラ内で例外が投げられた（`await` した Promise が reject された）場合は、Hono が捕まえて `app.onError` のハンドラ（既定は 500）に渡します（→ 10 章）。
- 素の `Response` を返しても構いません: `return new Response("ok", { status: 200 })`。
- 戻り値の型を明示したい場合でも、`c.json()` の推論された型（`TypedResponse`）を潰さないよう、無理に `Promise<Response>` と注釈しない方が RPC と相性が良いです。

## 今後に活かせるポイント

- 「入力を受け取り出力を返す関数」としてハンドラを捉えると、副作用が少なくテストしやすいコードになります。`app.request()` で `Response` を直接検証できます（→ 15 章）。
- ガード節で異常系を先に処理するパターンは、ネストが深くならず読みやすいです。

## 改善するなら

GET ハンドラは今のところ `await` が無いので `async` を外しても構いませんが、統一感のために残す判断もアリです。より実践的な改善は、データ取得を非同期関数に分け、そこで `await` することです。

```ts
const fetchTransactions = async (type: "income" | "expense" | "all") => {
  // 将来ここで DB にアクセスする
  return [{ id: 1, item: "給料", amount: 10000, date: "2025-01-01" }];
};

app.get("/transactions", async (c) => {
  // ...検証...
  const list = await fetchTransactions(type);
  return c.json({ transactions: list }, 200);
});
```

## 次に学ぶこと

- ストリーミングレスポンス（`hono/streaming` の `stream` / `streamSSE`）
- `HTTPException`（`hono/http-exception`）を throw して異常系を返す書き方（→ 10 章）
- Hono RPC で `c.json` の型がクライアントに伝わる仕組み
