# 手書きバリデーションの書き方とその限界

## 概要

API は外部から任意のデータを受け取るので、**入力値の検証（バリデーション）** が欠かせません。このプロジェクトでは、ライブラリを使わず `if` 文で検証し、NG なら 400 を返す「手書きバリデーション」をしています。仕組みを理解する第一歩としては最適ですが、項目が増えると限界がはっきり見えてきます。

## このプロジェクトでの実装

### GET: クエリの検証 `backend/src/index.ts:19-28`

```ts
const type = c.req.query("type");

if (!type || !["income", "expense", "all"].includes(type)) {
  return c.json({ message: "typeはincome,expense,allのいずれかである必要があります。" }, 400);
}
```

### POST: ボディの検証 `backend/src/index.ts:52-81`

```ts
const body = await c.req.json();
const { item, amount, date } = body;

if (!item || amount === undefined || !date) {             // 56行目: 必須チェック
  return c.json({ message: "必須項目が不足しています。" }, 400);
}

if (typeof amount !== "number" || amount === 0) {         // 65行目: 型と値のチェック
  return c.json({ message: "金額は0以外の数値である必要があります。" }, 400);
}

if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {                   // 74行目: 形式チェック
  return c.json({ message: "日付はYYYY-MM-DD形式で入力してください。" }, 400);
}

return c.json(body, 201);                                  // 83行目
```

良い点:

- ガード節で 1 つずつチェックしていて読みやすい
- `amount === undefined` で判定しているので、`0` を「未入力」と誤判定しない（`!amount` だと 0 も弾かれる）。0 は 65 行目で別のメッセージで弾いている
- エラーメッセージが具体的

## 重要語句

| 用語 | 意味 |
| --- | --- |
| バリデーション | 入力が期待する型・形式・範囲かを確かめること |
| ガード節 | 条件を満たさなければ即 return する書き方 |
| スキーマバリデーション | 「あるべき形」を宣言的に定義し、ライブラリで一括検証する方式（Zod など） |
| 型ガード | TypeScript で、実行時チェックによって型を絞り込む仕組み |
| `c.req.valid(target)` | Hono の validator ミドルウェアで検証済みの値を取り出す API |

## 仕様・注意点（現状の限界）

実際に穴になっている点を挙げます。

1. **`body` が `any` のため、型チェックが効かない**（05 章）。`item` が文字列かどうかを検証していないので、`{ "item": 123, ... }` や `{ "item": ["a"], ... }` も通ります。
2. **`date` が文字列かどうかを確かめていない**。`/^\d{4}-\d{2}-\d{2}$/.test(date)` は引数を文字列に変換するので（例外にはならない）、`date: 20250101`（数値）は `"20250101"` となり不一致 → 400 で済みます。一方、`date: ["2025-01-01"]`（配列）は文字列化すると `"2025-01-01"` になるため **検証を通過してしまいます**。型を確かめずに使っているのは危うい書き方です。
3. **日付として正しいかは見ていない**。`"2025-13-45"` も形式上は通ります。
4. **不正 JSON / `null` ボディで 500** になる（05・10 章）。
5. **余計なフィールドが素通り**。83 行目で `body` をそのまま返すため、`{ "item": "a", "amount": 1, "date": "2025-01-01", "isAdmin": true }` もそのままエコーされます。DB に保存する実装になったとき危険です。
6. **型が絞り込まれない**。検証後も `type` は `string`、`amount` は `any` のまま。検証ロジックと型定義が別々に存在し、ずれやすい。
7. **検証の重複**。フロント（フォーム）・OpenAPI（`backend/openapi.yaml`）・バックエンドの 3 か所に同じルールが散らばっている。
8. エラーは最初の 1 件しか返さないので、複数項目が同時に間違っていてもユーザーは 1 つずつしか直せない。

## 今後に活かせるポイント

- 手書きで書く場合でも「**unknown で受ける → 型ガードで絞る → 検証済みの値だけで新しいオブジェクトを作る**」の 3 ステップを守ると安全です。

```ts
type NewTransaction = { item: string; amount: number; date: string };

const parseNewTransaction = (v: unknown): NewTransaction | string => {
  if (typeof v !== "object" || v === null) return "リクエストボディが不正です。";
  const { item, amount, date } = v as Record<string, unknown>;
  if (typeof item !== "string" || item === "") return "itemは必須の文字列です。";
  if (typeof amount !== "number" || amount === 0) return "金額は0以外の数値です。";
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return "日付形式が不正です。";
  return { item, amount, date }; // 余計なフィールドを落とす
};
```

## 改善するなら

Zod 4 はすでに `backend/package.json` に入っている（env.ts で使用）ので、Hono の validator と組み合わせるのが自然です。

### 案1: 追加インストール不要（`hono/validator` + Zod）

```ts
import { validator } from "hono/validator";
import { z } from "zod";

const newTransactionSchema = z.object({
  item: z.string().min(1),
  amount: z.number().refine((n) => n !== 0, "金額は0以外の数値である必要があります。"),
  date: z.iso.date(), // Zod 4: YYYY-MM-DD 形式かつ実在する日付
});

app.post(
  "/transactions",
  validator("json", (value, c) => {
    const parsed = newTransactionSchema.safeParse(value);
    if (!parsed.success) {
      return c.json({ message: "入力が不正です。", issues: parsed.error.issues }, 400);
    }
    return parsed.data; // 余計なフィールドは z.object が取り除く
  }),
  (c) => {
    const tx = c.req.valid("json"); // { item: string; amount: number; date: string }
    return c.json({ id: 1, ...tx }, 201);
  },
);
```

### 案2: `@hono/zod-validator`（要インストール）

```ts
import { zValidator } from "@hono/zod-validator";

app.post("/transactions", zValidator("json", newTransactionSchema), (c) => {
  const tx = c.req.valid("json");
  return c.json(tx, 201);
});
```

どちらも、検証と型付けが 1 つのスキーマにまとまり、上の限界 1・3・5・6 が解消します。`validator("json")` は壊れた JSON を 400 にする（Content-Type が JSON の場合）ので、4 も改善します（05 章参照）。

## 次に学ぶこと

- `@hono/zod-validator` / `@hono/standard-validator`（Standard Schema 対応で Valibot なども使える）
- `@hono/zod-openapi`: Zod スキーマから OpenAPI を生成し、`openapi.yaml` との二重管理を解消（OpenAPI 自体は `study/API-Design`）
- フロントとスキーマを共有する（モノレポで共通パッケージ化、または Hono RPC）
