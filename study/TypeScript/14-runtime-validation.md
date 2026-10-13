# `as` の代替: 型ガードと Zod によるランタイム検証

## 概要

TypeScript の型はコンパイル時にしか存在しないので、「実行時に外から入ってくる値が本当にその型か」は自分でチェックするしかありません。その方法が主に 2 つあります。

1. **型ガード (type guard)**: `typeof` / `in` / `instanceof` や、`v is T` を返す自作関数でチェックし、通った後の型を絞り込む
2. **スキーマ検証ライブラリ**: Zod などで「データの形」を定義し、`parse` でチェックする。スキーマから型も自動生成できる

このプロジェクトのバックエンドでは、すでに Zod（`@t3-oss/env-core` 経由）で環境変数を検証しています。この仕組みを API の入力・出力にも広げるのが自然な発展です。

## このプロジェクトでの実装

### 実装済み: 環境変数を Zod で検証（backend）

`backend/src/env.ts:1`

```ts
import { createEnv } from "@t3-oss/env-core";
import z from "zod";
import dotenv from "dotenv";

dotenv.config();

export const env = createEnv({
  server: {
    FRONTEND_URL: z.string(),
  },
  runtimeEnv: process.env,
});
```

- `process.env.FRONTEND_URL` の型は Node.js の型定義上 `string | undefined` ですが、`createEnv` が起動時に Zod で検証し、通れば **`env.FRONTEND_URL` は `string` 型** として使えます（`backend/src/index.ts:11`）。
- 型はスキーマ `z.string()` から推論されています。「検証ロジック」と「型」が 1 か所にまとまっている点が、`as` との大きな違いです。

### 手書きの検証（backend の POST）

`backend/src/index.ts:52`

```ts
const body = await c.req.json();
const { item, amount, date } = body;

if (!item || amount === undefined || !date) { ... 400 }
if (typeof amount !== "number" || amount === 0) { ... 400 }
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { ... 400 }
```

- 実行時のチェックとしては機能していますが、`c.req.json()` の戻り値は `any`（`backend/node_modules/hono/dist/types/request.d.ts:141` の `json<T = any>(): Promise<T>`）なので、`item` / `amount` / `date` もすべて `any` です。そのため `typeof amount !== "number"` の後でも型の絞り込みの恩恵はほぼなく、`item` が文字列かどうかもチェックされていません（`!item` は空文字や `0` を弾くだけ）。

### 検証なし（web-app）

`useIncomeTransactions.ts:19` などの `response.json() as TransactionListInfo` は検証していません（→ `13-type-assertion-as.md`）。

## 重要語句

| 用語 | 意味 |
| --- | --- |
| 型ガード (type guard) | 実行時チェックで型を絞り込む式・関数 |
| 型述語 (type predicate) | `(v: unknown): v is T` の `v is T`。true を返したら v は T だと宣言する |
| スキーマ | データの形と制約の定義。Zod では `z.object({...})` |
| `parse` / `safeParse` | Zod の検証メソッド。前者は失敗で例外、後者は `{ success, data / error }` を返す |
| `z.infer<typeof schema>` | スキーマから TypeScript の型を取り出す |

## 仕様・注意点

- **型述語は「嘘」もつける**: `v is T` の関数本体のチェックが甘くても、コンパイラは信じます。型ガード関数自体のテストが大切です。
- `typeof` で判定できるのは `"string" | "number" | "bigint" | "boolean" | "symbol" | "undefined" | "object" | "function"` だけ。`typeof null === "object"` に注意。
- Zod 4 では `import { z } from "zod"` が公式ドキュメントの基本形です。このプロジェクトの `import z from "zod"`（デフォルトインポート）も型チェックを通っています。
- `z.string()` は空文字 `""` も通します。必須にしたいなら `z.string().min(1)`、URL なら `z.url()`（Zod 4）のように制約を足します。
- 実行時検証には（わずかながら）コストがかかり、web-app に Zod を入れるとバンドルサイズも増えます。境界（API の入口・出口）でだけ行うのが一般的です。

## 今後に活かせるポイント

- 「信頼できない入力は境界で 1 回だけ検証し、内側では型を信じる」が基本パターン。
- スキーマを先に書き、型は `z.infer` で生成する（型と検証の二重管理をなくす）。
- Hono には `@hono/zod-validator` があり、リクエストの検証結果が `c.req.valid("json")` で型付きで受け取れます（詳細は Hono フォルダの担当範囲）。

## 改善するなら

### backend: リクエストボディを Zod で検証

```ts
import { z } from "zod";

const newTransactionSchema = z.object({
  item: z.string().min(1),
  amount: z.number().refine((n) => n !== 0, "金額は0以外の数値である必要があります。"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日付はYYYY-MM-DD形式で入力してください。"),
});
type NewTransaction = z.infer<typeof newTransactionSchema>;
// => { item: string; amount: number; date: string }

app.post("/transactions", async (c) => {
  const result = newTransactionSchema.safeParse(await c.req.json());
  if (!result.success) {
    return c.json({ message: result.error.issues[0]?.message }, 400);
  }
  const body = result.data; // NewTransaction 型
  return c.json(body, 201);
});
```

### web-app: 依存を増やさず型ガードで検証

```ts
const isTransaction = (v: unknown): v is Transaction =>
  typeof v === "object" &&
  v !== null &&
  "id" in v && typeof v.id === "number" &&
  "item" in v && typeof v.item === "string" &&
  "amount" in v && typeof v.amount === "number" &&
  "date" in v && typeof v.date === "string";
```

（`in` による絞り込みで `v.id` にアクセスできるのは TypeScript 4.9 以降の機能です。）フィールドが増えると手書きはつらくなるので、Zod などのライブラリを使うほうが現実的です。

## 次に学ぶこと

- `asserts v is T` を返すアサーション関数
- Zod の `safeParse`、`transform`、`coerce`（フォームの文字列 → 数値変換など）
- Valibot / ArkType など他のスキーマライブラリ
- Standard Schema（複数のスキーマライブラリ共通のインターフェース）
- OpenAPI（`backend/openapi.yaml`）から型やスキーマを生成する方法 → `29-type-sharing-fe-be.md`
