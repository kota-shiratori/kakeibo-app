# クエリパラメータの取得 `c.req.query`

## 概要

URL の `?` 以降（クエリ文字列）は、一覧の絞り込みや検索条件を渡すのによく使われます。Hono では `c.req.query()` で取り出します。

## このプロジェクトでの実装

フロントエンドはクエリ付きで GET します。

`web-app/src/hooks/useExpenseTransactions.ts:15`

```ts
const response = await fetch(`${BASE_URL}/transactions?type=expense`);
```

バックエンドでの受け取り: `backend/src/index.ts:19-28`

```ts
const type = c.req.query("type");

if (!type || !["income", "expense", "all"].includes(type)) {
  return c.json(
    {
      message: "typeはincome,expense,allのいずれかである必要があります。",
    },
    400,
  );
}
```

- 19 行目: `type` の値を文字列で取得。指定がなければ `undefined`
- 21 行目: 未指定、または許可された 3 値以外なら 400 を返す（手書きバリデーション → 11 章）

ただし現状、`type` を検証したあと **その値で絞り込む処理はまだありません**（30-37 行目は固定のダミーデータ）。

## 重要語句

| API | 戻り値の型（`types/request.d.ts` で確認） | 説明 |
| --- | --- | --- |
| `c.req.query("key")` | `string \| undefined` | 指定キーの値（同じキーが複数あれば **最初の 1 つ**） |
| `c.req.query()` | `Record<string, string>` | 全クエリをオブジェクトで（各キー最初の値） |
| `c.req.queries("key")` | `string[] \| undefined` | 同じキーの値をすべて配列で（`?tags=A&tags=B`） |

## 仕様・注意点

- **値は常に文字列**: `?limit=10` でも `"10"`（string）です。数値として使うなら変換と検証が必要です。
- **重複キー**: 実際に `?type=a&type=b` で試すと、`query("type")` は `"a"`、`queries("type")` は `["a","b"]`、`query()` は `{ type: "a" }` でした。
- **空文字**: `?type=` の場合は `""` が返ります。このプロジェクトの `!type` チェックは空文字も弾けています。
- **URL デコード** は Hono が行います（`%E7%B5%A6` → `給`）。
- TypeScript 上、`["income", "expense", "all"].includes(type)` を通過しても `type` は `string` のままで、`"income" | "expense" | "all"` には **絞り込まれません**（`Array.prototype.includes` は型ガードではないため）。

## 今後に活かせるポイント

- 許可値の一覧を `as const` の配列にしておき、型ガード関数を作ると「検証」と「型の絞り込み」を同時に行えます。

```ts
const TYPES = ["income", "expense", "all"] as const;
type TxType = (typeof TYPES)[number];
const isTxType = (v: string | undefined): v is TxType =>
  v !== undefined && (TYPES as readonly string[]).includes(v);
```

## 改善するなら

1. 検証した `type` を実際に使ってフィルタする。
2. スキーマバリデーション（Hono 組み込みの `validator` や `@hono/zod-validator`）を使い、型も自動で付ける。

```ts
import { zValidator } from "@hono/zod-validator"; // 別途インストールが必要
import { z } from "zod";

app.get(
  "/transactions",
  zValidator("query", z.object({ type: z.enum(["income", "expense", "all"]) })),
  (c) => {
    const { type } = c.req.valid("query"); // "income" | "expense" | "all" 型
    const list = type === "all" ? all : all.filter((t) => t.type === type);
    return c.json({ transactions: list }, 200);
  },
);
```

※ `@hono/zod-validator` は現在の `backend/package.json` には入っていません。`zod` 4 は導入済みです。

## 次に学ぶこと

- `c.req.param()` によるパスパラメータ（`/transactions/:id`）
- `c.req.valid("query")` と validator ミドルウェア（→ 11 章）
- ページネーション用クエリ（`limit` / `offset` / `cursor`）の設計は `study/API-Design` 側で
