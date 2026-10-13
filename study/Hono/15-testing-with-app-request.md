# `app.request()` でサーバーを起動せずに動作確認する

## 概要

Hono アプリは「`Request` → `Response` の関数」なので、**ポートを開かなくても** リクエストを投げて結果を確かめられます。そのための便利メソッドが `app.request()` です。テストコードはもちろん、ちょっとした挙動確認にも使えます。

このノートシリーズ（02, 05, 06, 08, 09, 10 章）に書いた挙動の多くは、実際に `app.request()` を使って確認したものです。

## このプロジェクトでの実装

現在の backend にテストコードはありません。`backend/src/index.ts` は 6 行目で `app` を作り、86 行目で `serve()` を即実行しているため、**`app` だけを import してテストすることができない** 構造です（import した瞬間にサーバーが起動してしまう）。

`app.request` の実装（`node_modules/hono/dist/hono-base.js`）:

```js
request = (input, requestInit, Env, executionCtx) => {
  if (input instanceof Request) return this.fetch(requestInit ? new Request(input, requestInit) : input, Env, executionCtx);
  input = input.toString();
  return this.fetch(
    new Request(/^https?:\/\//.test(input) ? input : `http://localhost${mergePath("/", input)}`, requestInit),
    Env, executionCtx);
};
```

- パスだけ渡すと `http://localhost` が補われる
- 中身は `new Request(...)` を作って `app.fetch` を呼んでいるだけ

## 重要語句

| 用語 | 意味 |
| --- | --- |
| `app.request(pathOrUrlOrRequest, init?, env?, executionCtx?)` | アプリにリクエストを送り `Response`（Promise）を得る |
| `RequestInit` | `fetch` の第 2 引数と同じオプション（`method`, `headers`, `body` など） |
| `testClient`（`hono/testing`） | RPC の型付きクライアントでテストを書くヘルパー |

## 仕様・注意点

- ブラウザではないので、**CORS の制限は適用されません**。CORS ヘッダが付いているかどうかはレスポンスヘッダを見て確認します。
- `body` に文字列を渡し `headers` を指定しない場合、`Request` の仕様により Content-Type は `text/plain;charset=UTF-8` になります。`c.req.json()` は Content-Type を見ないので問題ありませんが、`validator("json")` を使うルートでは `Content-Type: application/json` を明示しないとパースされません（05 章）。
- `env` 引数で `c.env` に入る値を差し込めるので、Workers の Bindings を使うコードもテストできます。

## 今後に活かせるポイント

`app` を別ファイルに分けておけば（01 章の改善案）、Vitest などで次のように書けます。

```ts
// src/app.test.ts
import { describe, it, expect } from "vitest";
import { app } from "./app.js";

describe("GET /transactions", () => {
  it("type が無ければ 400", async () => {
    const res = await app.request("/transactions");
    expect(res.status).toBe(400);
  });

  it("type=all で 200 と一覧", async () => {
    const res = await app.request("/transactions?type=all");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalCount).toBe(1);
  });
});

describe("POST /transactions", () => {
  it("金額 0 は 400", async () => {
    const res = await app.request("/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item: "x", amount: 0, date: "2025-01-01" }),
    });
    expect(res.status).toBe(400);
  });
});
```

## 改善するなら

1. `app` 定義と `serve()` を別ファイルに分ける。
2. ただし `backend/src/env.ts` は import 時に環境変数を検証するため、テスト時にも `FRONTEND_URL` が必要になる点に注意（テスト用の値を設定する。詳細は `study/API-Design`）。
3. 上のテストのように、手書きバリデーションの各分岐（11 章）をテストで固定しておくと、Zod などへの置き換え時に安全にリファクタリングできます。

## 次に学ぶこと

- `testClient`（`hono/testing`）と Hono RPC を使った型安全なテスト
- Vitest のセットアップ（ツール面は `study/Tooling`）
- Cloudflare Workers 向けには `@cloudflare/vitest-pool-workers` を使ったテスト
