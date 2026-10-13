# 入力値検証（バリデーション）の仕様

## 概要

API は「誰がどんなデータを送ってくるか分からない」前提で作ります。フロントエンドの入力フォームで制限していても、curl やブラウザの開発者ツールを使えば任意のデータを直接送れるからです。

> **フロントの検証は使いやすさのため、サーバーの検証は安全性・正しさのため。** サーバー側の検証は省略できません。

検証では一般に次の観点を確認します。

1. **存在**（必須項目があるか）
2. **型**（文字列か、数値か）
3. **形式**（日付形式、メール形式など）
4. **範囲・値**（0 以外、文字数の上限、未来日付の禁止など）
5. **意味**（実在する日付か、参照先が存在するか）

## このプロジェクトでの実装

`POST /transactions` の検証は 3 段階です。

### 1. 必須チェック — `backend/src/index.ts:56-63`

```ts
if (!item || amount === undefined || !date) {
  return c.json({ message: "必須項目が不足しています。" }, 400);
}
```

- `item` と `date` は「falsy（`undefined`, `null`, `""` など）なら不足」と判定。
- `amount` だけ `=== undefined` で判定しているのは、`!amount` だと **`0` も「不足」扱いになってしまう** ため。0 は次の段階で「金額不正」として別のメッセージを返したい、という意図が読み取れます。

### 2. 金額チェック — `backend/src/index.ts:65-72`

```ts
if (typeof amount !== "number" || amount === 0) {
  return c.json({ message: "金額は0以外の数値である必要があります。" }, 400);
}
```

- `typeof amount !== "number"` で `"100"`（文字列）を弾く（curl で確認: `"amount":"100"` は 400）。
- `amount === 0` で 0 円を弾く。収支は符号で収入（正）・支出（負）を表すので、0 には意味がないという仕様です。

### 3. 日付形式チェック — `backend/src/index.ts:74-81`

```ts
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  return c.json({ message: "日付はYYYY-MM-DD形式で入力してください。" }, 400);
}
```

- `^` と `$` で文字列全体を対象にし、「数字 4 桁 - 数字 2 桁 - 数字 2 桁」だけを通す。
- **形式しか見ていない** ので、`2025-13-45` のような存在しない日付も通ります（→ `10-date-validation-pitfalls.md`）。

### 仕様書との対応 — `backend/openapi.yaml:94-118`

| 項目 | 仕様書 | 実装 |
| --- | --- | --- |
| item | `type: string`, `minLength: 1`, 必須 | `!item` のみ（型チェックなし） |
| amount | `type: number`, `not: { const: 0 }`, 必須 | `typeof === "number"` かつ `!== 0` |
| date | `type: string`, `format: date`, `pattern`, 必須 | 正規表現のみ（型チェックなし） |

### フロント側の補助的な制限 — `web-app/src/pages/Input.tsx`

- 項目: `maxLength={20}`（`:89`）
- 金額: `type="number"`, `min={0}`（`:96`, `:100`）、支出なら符号を反転（`:32-36`）
- 日付: `type="date"`（`:106`）— ブラウザの日付ピッカーは `YYYY-MM-DD` 形式の値を返す
- 各フィールドに `Field.Root required`（`:84`, `:93`, `:103`）

## 重要語句

- **バリデーション（検証）**: 入力が仕様を満たすか確認すること。
- **falsy**: `if` で偽とみなされる値（`false`, `0`, `-0`, `""`, `null`, `undefined`, `NaN` など）。
- **型ガード**: `typeof x === "number"` のように、実行時に型を確かめる処理。
- **スキーマバリデーション**: 期待するデータの形（スキーマ）を宣言し、それに照らして検証する方式（Zod など）。

## 仕様・注意点

実際に curl で送って確認した「すり抜け」です。

- **`item` の型を見ていない**: `"item": 123` が 201 で通る。仕様書は `type: string`。
- **`date` の型を見ていない**: `"date": ["2025-01-01"]`（配列）が 201 で通る。`RegExp.prototype.test` は引数を文字列に変換するため、配列 `["2025-01-01"]` は `"2025-01-01"` になって正規表現にマッチしてしまいます。
- **余分なプロパティがそのまま返る**: `"extra": "x"` を付けると、レスポンスにもそのまま含まれる（`return c.json(body, 201)`、`backend/src/index.ts:83`）。DB 保存時に body をそのまま渡すと、意図しない列を書き換えられる危険（マスアサインメント）につながります。
- **`item` の上限がない**: フロントは 20 文字制限ですが、サーバーと仕様書には上限がありません。
- **空白だけの `item`**（`"   "`）は `!item` も `minLength: 1` もすり抜けます。
- `null` のボディや壊れた JSON は検証より前に例外になり 500 になる（→ `04-http-status-codes.md`）。

その他の注意:

- 金額の上限がないため、`1e300` のような極端な値も通ります。
- JSON では `NaN` や `Infinity` を直接書けませんが、`1e400` のように範囲外の数値リテラルは `JSON.parse` で `Infinity` になります。`typeof Infinity === "number"` かつ `0` でもないので、`{"item":"a","amount":1e400,"date":"2025-01-01"}` は現在の検証を通過し、201 のレスポンスでは `JSON.stringify` により `"amount":null` に化けます（Hono 4.13.13 で再現を確認）。有限数に限定するなら `Number.isFinite(amount)` で確認します（Zod 4 の `z.number()` は `Infinity` を拒否します）。

## 今後に活かせるポイント

- 手書きの `if` 文による検証は、項目が増えると漏れが出やすくなります。スキーマバリデーションライブラリ（このプロジェクトには既に Zod が入っています）を使うと、**仕様書のスキーマと 1 対 1 に近い形で書けます**。
- 検証を通過したデータだけを、必要なプロパティだけ取り出して使う（ホワイトリスト方式）のが安全です。

## 改善するなら

Zod 4 で仕様書の `TransactionInput` をそのまま表現する例です。

```ts
import { z } from "zod";

const TransactionInput = z.object({
  item: z.string().trim().min(1).max(20),
  // Zod 4 ではエラーメッセージは `error` で指定する（`message` は非推奨）
  amount: z.number().refine((n) => n !== 0, { error: "金額は0以外の数値である必要があります。" }),
  date: z.iso.date(), // 実在する日付のみ（2025-13-45 や 2025-02-30 は NG）
});
// z.object は既定で未知のキーを取り除く（strip）ので、extra は結果に含まれない

app.post("/transactions", async (c) => {
  const json = await c.req.json().catch(() => undefined);
  const result = TransactionInput.safeParse(json);
  if (!result.success) {
    return c.json({ message: result.error.issues[0]?.message ?? "入力が不正です。" }, 400);
  }
  const input = result.data; // { item: string; amount: number; date: string } 型
  // ...保存処理
});
```

`z.iso.date()` が `2025-13-45` / `2025-02-30` / `2025-02-29` を拒否し、`2024-02-29`（うるう年）を受け入れることは、このプロジェクトの Zod 4.6.6 で実行して確認しました。

## 次に学ぶこと

- `@hono/zod-validator` や `@hono/zod-openapi` でルート定義と検証・仕様を一体化する
- フロントとバックで検証スキーマを共有する（モノレポの共有パッケージ）
