# 既定のエラー処理と 404（onError / notFound）

## 概要

Hono は、ハンドラで例外が起きたときやどのルートにもマッチしなかったときに、**既定のレスポンス** を返します。このプロジェクトでは独自のエラーハンドラを設定していないため、この既定動作がそのまま使われています。どんなときに何が返るかを知っておくと、フロントエンド側のエラー処理やデバッグで迷いません。

## このプロジェクトでの実装

`backend/src/index.ts` には `app.onError` も `app.notFound` も **書かれていません**。つまり以下の既定動作になります。

既定ハンドラの実装（`node_modules/hono/dist/hono-base.js`、Hono 4.13.13）:

```js
const notFoundHandler = (c) => {
  return c.text("404 Not Found", 404);
};
const errorHandler = (err, c) => {
  if ("getResponse" in err) {           // HTTPException の場合
    const res = err.getResponse();
    return c.newResponse(res.body, res);
  }
  console.error(err);                   // それ以外はログに出して
  return c.text("Internal Server Error", 500);
};
```

このプロジェクトで実際に既定ハンドラに落ちるケース（現在の `index.ts` を `app.request()` で呼び出して確認。DB は使い捨てのデータベースを使用）:

| リクエスト | 何が起きるか | レスポンス |
| --- | --- | --- |
| `GET /`（ルート未定義） | notFound | 404 `404 Not Found`（`text/plain; charset=UTF-8`） |
| `GET /transactions/`（末尾スラッシュ） | notFound | 404（text/plain） |
| `POST /transactions` に `{bad`（不正 JSON） | `backend/src/index.ts:78` の `c.req.json()` が `SyntaxError` | 500 `Internal Server Error`（text/plain） |
| `POST /transactions` に `null` | `backend/src/index.ts:79` の分割代入で `TypeError` | 500（text/plain） |
| `POST` で `item` が 21 文字 | `pool.query` が `22001 value too long for type character varying(20)` で reject | 500（text/plain） |
| `POST` で `amount` が `1.5` | `pool.query` が `22P02 invalid input syntax for type integer` で reject | 500（text/plain） |
| `POST` で `date` が `2025-02-30` | `pool.query` が `22008 date/time field value out of range` で reject | 500（text/plain） |
| DB に接続できない（コンテナ停止中など）状態で `GET /transactions?type=all` | `pool.query` が `connect ECONNREFUSED` で reject | 500（text/plain） |

いずれも CORS ミドルウェアは先に通っているので、CORS ヘッダは付いていました。既定のエラーハンドラは `console.error(err)` するので、サーバーのコンソールには `pg` のエラー（`code: '22001'` などの詳細付き）がそのまま出ます。

DB の制約違反は、本来は利用者の入力ミス（400）です。backend の検証が DB の型・制約（`VARCHAR(20)`・`INTEGER`・実在する日付）より緩いため、DB まで届いてから 500 になっています（11 章、`../Database/03-schema-design-for-kakeibo.md`、`../PostgreSQL/05-constraints-and-errors.md`）。

## 重要語句

| 用語 | 意味 |
| --- | --- |
| `app.notFound(handler)` | マッチするルートがないときのレスポンスをカスタマイズ |
| `app.onError((err, c) => Response)` | ハンドラ/ミドルウェアで投げられた例外をまとめて処理 |
| `HTTPException` | `hono/http-exception`。ステータス付きで throw できる例外クラス。`getResponse()` を持つ |
| `console.error(err)` | 既定エラーハンドラはサーバーのコンソールにスタックトレースを出す |

## 仕様・注意点

- **既定の 404 / 500 は JSON ではなく text/plain**。API 全体を JSON で統一したいなら、`notFound` と `onError` を上書きする必要があります。
- フロントエンドのフック（`web-app/src/hooks/useAddTransactions.ts:19` など）は `response.ok` だけを見ているので、今は形式の違いで壊れることはありません。しかし将来 `await response.json()` でエラー本文を読もうとすると、text/plain の 404/500 で JSON パースに失敗します。
- `HTTPException` を throw すると、既定のエラーハンドラでも **指定したステータスのレスポンス** に変換されます（`getResponse` を持っているため）。
- `onError` に渡されるのは `Error` のインスタンスだけです。`Error` 以外の値（`throw "文字列"` など）は `#handleError` で再 throw されます（実装で確認）。素直に `Error` を throw しましょう。
- `app.route()` でサブアプリを組み込む場合、サブアプリに独自の `onError` があればそちらが優先されます。

## 今後に活かせるポイント

API サーバーでは、最初に次の 2 つを設定しておくのが定番です。

```ts
import { HTTPException } from "hono/http-exception";

app.notFound((c) => c.json({ message: "Not Found" }, 404));

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ message: err.message }, err.status);
  }
  console.error(err);
  return c.json({ message: "Internal Server Error" }, 500);
});
```

ハンドラの奥深く（サービス層など）からでも `throw new HTTPException(404, { message: "..." })` するだけで適切なレスポンスになるので、エラー処理がシンプルになります。

## 改善するなら

不正 JSON や DB の制約違反（どちらもクライアントのミス）が 500（サーバーのミス扱い）になっているのが一番の問題です。

- 不正 JSON：`onError` で `SyntaxError` を 400 に変換する、または 05 章のように `c.req.json()` を try/catch する
- DB の制約違反：まず入力検証を DB の制約に揃えて DB まで届かないようにする（11 章）。そのうえで、念のため `pg` のエラーの `code`（SQLSTATE）を見て、`22xxx`（データの例外）・`23xxx`（制約違反）を 400 に変換する手もあります

```ts
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ message: err.message }, err.status);
  }
  if (err instanceof SyntaxError) {
    return c.json({ message: "JSONの形式が不正です。" }, 400);
  }
  // pg の DatabaseError は SQLSTATE を code に持つ（22001 / 22P02 / 22008 / 23502 など）
  if (err instanceof DatabaseError && /^2[23]/.test(err.code ?? "")) {
    return c.json({ message: "入力値が不正です。" }, 400);
  }
  console.error(err);
  return c.json({ message: "Internal Server Error" }, 500);
});
```

（`DatabaseError` は `import { DatabaseError } from "pg"` で取り込めます。接続エラー `ECONNREFUSED` は `DatabaseError` ではないので 500 のままになり、これはサーバー側の障害なので正しい扱いです。）

※ `SyntaxError` を一律 400 にすると、サーバー側コードのバグ由来の SyntaxError（例: 外部 API レスポンスのパース失敗）まで 400 になってしまう点には注意。本来は JSON パース箇所で個別に処理する方が正確です。

## 次に学ぶこと

- `HTTPException` の `res` オプション（任意の Response を返す）や `cause`
- エラーレスポンス形式の標準化（RFC 9457 Problem Details など）→ `study/API-Design`
- ロギング（`hono/logger`）や外部監視サービスへの通知を `onError` に組み込む
