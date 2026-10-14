# ハンドラは Response を返す（async ハンドラ）

## 概要

Hono のハンドラの基本ルールはただ 1 つ、**「Context を受け取り、`Response` を返す」** です。

```ts
(c) => Response | Promise<Response>
```

Express のように `res.send()` を「呼ぶ」のではなく、`Response` を「返す（return する）」のが特徴です。`c.json()` や `c.text()` は、その `Response` を簡単に作るためのヘルパーです。

ハンドラ内で `await`（ボディの読み取り、DB アクセス、外部 API 呼び出しなど）を使いたい場合は `async` 関数にします。async 関数は `Promise<Response>` を返し、Hono はそれを待ってからクライアントに返します。

## このプロジェクトでの実装

`backend/src/index.ts:29`（GET）と `backend/src/index.ts:77`（POST）は、どちらも `async` で書かれています。どちらもハンドラの中で DB に SQL を送り、その結果を `await` で待つためです。

```ts
app.get("/transactions", async (c) => {
  const type = c.req.query("type");
  if (!type || ...) {
    return c.json({ message: "..." }, 400); // 早期 return
  }
  // ...
  const historyResult = await pool.query(historyQuery); // ← DB の応答を待つ
  const countResult = await pool.query(countQuery);
  // ...
  return c.json(result, 200);               // 正常系の return
});
```

```ts
app.post("/transactions", async (c) => {
  const body = await c.req.json();          // ← ボディの読み取りを待つ
  // ...
  const result = await pool.query(          // ← INSERT の結果を待つ
    `INSERT INTO transactions (item, amount, date) VALUES ($1, $2, $3) RETURNING id, item, amount, date`,
    [item, amount, date],
  );
  // ...
  return c.json(newTransaction, 201);
});
```

- GET ハンドラは `await pool.query(...)`（53-54 行目）があるため `async` が必須です。
- POST ハンドラは `await c.req.json()`（78 行目）と `await pool.query(...)`（93 行目）があるため `async` が必須です。
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

- ハンドラ内で例外が投げられた（`await` した Promise が reject された）場合は、Hono が捕まえて `app.onError` のハンドラ（既定は 500）に渡します（→ 10 章）。このプロジェクトでは、DB に接続できない（`ECONNREFUSED`）・制約違反（21 文字の `item` など）で `pool.query` が reject されると、この経路で 500 になります（実験で確認）。
- 素の `Response` を返しても構いません: `return new Response("ok", { status: 200 })`。
- 戻り値の型を明示したい場合でも、`c.json()` の推論された型（`TypedResponse`）を潰さないよう、無理に `Promise<Response>` と注釈しない方が RPC と相性が良いです。

## 今後に活かせるポイント

- 「入力を受け取り出力を返す関数」としてハンドラを捉えると、副作用が少なくテストしやすいコードになります。`app.request()` で `Response` を直接検証できます（→ 15 章）。
- ガード節で異常系を先に処理するパターンは、ネストが深くならず読みやすいです。

## 改善するなら

今はハンドラの中で SQL を組み立てて `pool.query` を直接 `await` しています。データ取得を非同期関数（リポジトリ）に分け、ハンドラはそれを `await` するだけにすると、ハンドラが「入力の検証 → 取得 → Response を返す」に集中でき、テストでは偽物の関数に差し替えられます（`../Architecture/15-persistence-and-repository-layer.md`）。

```ts
const listTransactions = async (type: "income" | "expense" | "all") => {
  const where = { income: " WHERE amount > 0", expense: " WHERE amount < 0", all: "" }[type];
  const result = await pool.query(`SELECT id, item, amount, date FROM transactions${where} ORDER BY date DESC, id DESC`);
  return result.rows.map(toTransaction); // 行 → API の形への変換
};

app.get("/transactions", async (c) => {
  // ...検証...
  const list = await listTransactions(type);
  return c.json({ transactions: list }, 200);
});
```

## 次に学ぶこと

- ストリーミングレスポンス（`hono/streaming` の `stream` / `streamSSE`）
- `HTTPException`（`hono/http-exception`）を throw して異常系を返す書き方（→ 10 章）
- Hono RPC で `c.json` の型がクライアントに伝わる仕組み
