# 発展: Hono RPC（`hc` クライアント）でフロントと型を共有する

## 概要

Hono には、サーバーのルート定義から **クライアント側の型付き API 呼び出し関数を自動で得られる** 「RPC」機能があります。サーバー側でアプリの型（`typeof app`）を export し、フロント側で `hc<AppType>(baseUrl)` を使うと、パス・クエリ・ボディ・レスポンスの型がすべて補完されます。

家計簿アプリのように **backend と web-app が同じリポジトリにある** 構成では特に効果的です。

## このプロジェクトでの実装

現状は RPC を使っておらず、フロントは素の `fetch` と手書きの型で API を呼んでいます。

`web-app/src/hooks/useExpenseTransactions.ts:15-19`

```ts
const response = await fetch(`${BASE_URL}/transactions?type=expense`);
if (!response.ok) {
  throw new Error("支出データの取得に失敗しました。");
}
const data = (await response.json()) as TransactionListInfo;
```

- URL 文字列（`/transactions?type=expense`）の打ち間違いは型でチェックされない
- `as TransactionListInfo` は「型を信じ込ませる」だけで、サーバーのレスポンス形式が変わっても気づけない

## 重要語句

| 用語 | 意味 |
| --- | --- |
| `hc`（`hono/client`） | Hono アプリの型から型付きクライアントを作る関数 |
| `AppType` | `export type AppType = typeof routes` のように export するアプリの型 |
| `c.req.valid()` | validator を通すと、その入力型が RPC クライアントの引数型になる |
| `TypedResponse` | `c.json(body, status)` の戻り値の型。クライアントの `res.json()` の型になる |

## 仕様・注意点

- 型を伝えるには、**ルートをメソッドチェーンで定義して、その戻り値の型を使う** 必要があります（`app.get(...)` を別々の文で書くと、`typeof app` にルート情報が蓄積されません）。
- 入力の型（クエリやボディ）をクライアントに伝えるには、validator（`hono/validator` や `@hono/zod-validator`）を使います。手書きバリデーション（11 章）では入力型は伝わりません。
- `c.json(x, 200)` / `c.json(err, 400)` のようにステータスを明示すると、クライアントで `res.status` による分岐時にボディの型が絞り込まれます（07 章）。
- フロントは backend の **型だけ** を import します（`import type`）。サーバーのコードがフロントのバンドルに入るわけではありません。ただし、フロントの TypeScript から backend のソースを参照できる構成（モノレポ設定）が必要です。

## 今後に活かせるポイント

概略のコード例です（現プロジェクトでそのまま動く形ではなく、イメージ）。

```ts
// backend/src/app.ts
const routes = new Hono()
  .get(
    "/transactions",
    zValidator("query", z.object({ type: z.enum(["income", "expense", "all"]) })),
    (c) => c.json({ transactions: [], totalCount: 0, totalAmount: 0 }, 200),
  );
export type AppType = typeof routes;

// web-app 側
import { hc } from "hono/client";
import type { AppType } from "../../backend/src/app";

const client = hc<AppType>(import.meta.env.VITE_API_BASE_URL);
const res = await client.transactions.$get({ query: { type: "expense" } });
if (res.ok) {
  const data = await res.json(); // { transactions: ...; totalCount: number; ... } 型
}
```

## 改善するなら

段階的に進めるのがおすすめです。

1. 01 章: `app` 定義をファイル分割
2. 11 章: Zod + validator で入力検証と型付け
3. 07 章: ステータス付き `c.json` で出力の型を明確化
4. 本章: `AppType` を export し、フロントの hooks を `hc` に置き換え

## 次に学ぶこと

- Hono 公式ドキュメント「RPC」ガイド（大規模アプリでの型推論コスト対策も載っている）
- `@hono/zod-openapi` で OpenAPI と RPC の両方を 1 つの定義から得る
- TanStack Query と `hc` の組み合わせ（データ取得のキャッシュ・再取得）
