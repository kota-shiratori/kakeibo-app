# バリデーションの多層化 — HTML・フロント・バックエンド・OpenAPI

## 概要

「入力が正しいか」のチェック（バリデーション）は、このプロジェクトでは **4 つの層** に分散しています。それぞれ目的が違い、どれか 1 つで全部をまかなうことはできません。

| 層 | 目的 | 信頼できるか |
|---|---|---|
| HTML 属性 | 入力中のユーザーに即座に気づかせる（UX） | ✕（ブラウザ側で簡単に回避できる） |
| フロントの JS | 送信前の整形・変換、即時フィードバック | ✕（同上） |
| バックエンド | **不正なデータを絶対に通さない最後の砦** | ◯ |
| OpenAPI スキーマ | ルールを文書化した「契約」 | —（実行はされない） |

原則は「**セキュリティと正しさはサーバーで保証し、クライアントの検証は使いやすさのため**」です。

## このプロジェクトでの実装

### 層 1: HTML 属性（`web-app/src/pages/Input.tsx`）

| 項目 | 指定 | 行 |
|---|---|---|
| 項目 | `Field.Root required`、`maxLength={20}` | `:84`, `:89` |
| 金額 | `Field.Root required`、`type="number"`、`min={0}` | `:93`, `:96`, `:100` |
| 日付 | `Field.Root required`、`type="date"` | `:103`, `:106` |

`<form>` の `onSubmit`（`:63`）は、ブラウザの制約検証（constraint validation）を通過したときだけ発火します。`type="date"` の入力欄は値を `YYYY-MM-DD` 形式の文字列で返すので、日付形式は実質ここで揃います。`Field.Root` の `required` が入力欄にどう伝わるかは ChakraUI フォルダ参照。

### 層 2: フロントの JS（`web-app/src/pages/Input.tsx:32-36`）

```ts
let adjustAmount = Number(amount);
if (transactionType === "expense" && adjustAmount > 0) {
  adjustAmount = -adjustAmount;
}
```

ここは「検証」というより **変換**（文字列 → 数値、支出 → 負数）です。独自のエラーチェックはありません。

### 層 3: バックエンド（`backend/src/index.ts`）

```ts
// GET: クエリの列挙チェック :21
if (!type || !["income", "expense", "all"].includes(type)) { ... 400 }

// POST: 必須チェック :56
if (!item || amount === undefined || !date) { ... 400 }
// 型と値のチェック :65
if (typeof amount !== "number" || amount === 0) { ... 400 }
// 形式チェック :74
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { ... 400 }
```

### 層 4: OpenAPI スキーマ（`backend/openapi.yaml:94-118`）

```yaml
TransactionInput:
  required: [item, amount, date]
  properties:
    item:   { type: string, minLength: 1 }
    amount: { type: number, not: { const: 0 } }
    date:   { type: string, format: date, pattern: "^\\d{4}-\\d{2}-\\d{2}$" }
```

### 層ごとのルール対応表

| ルール | HTML | フロント JS | バックエンド | OpenAPI |
|---|---|---|---|---|
| item 必須 | `required` | — | `!item` | `required` + `minLength: 1` |
| item 最大 20 文字 | `maxLength={20}` | — | **なし** | **なし** |
| amount 必須 | `required` | — | `amount === undefined` | `required` |
| amount が数値 | `type="number"` | `Number()` | `typeof` | `type: number` |
| amount ≠ 0 | **なし**（`min={0}` は 0 を許す） | — | `amount === 0` | `not: const: 0` |
| amount ≥ 0（入力時） | `min={0}` | — | （負数は支出として正当） | — |
| date 必須 | `required` | — | `!date` | `required` |
| date 形式 | `type="date"` | — | 正規表現 | `format` + `pattern` |
| type クエリ | — | （固定値で送る） | 列挙チェック | `enum` |

## 重要語句

- **バリデーション（検証）**: 入力が期待する条件を満たすか確認すること。
- **制約検証（Constraint Validation）**: HTML の `required` / `min` / `maxLength` / `type` などによるブラウザ組み込みの検証。
- **多層防御（Defense in Depth）**: 1 つの防御が破られても次の層で止められるよう、複数の層で守る考え方。
- **信頼境界（trust boundary）**: ここから先に来るデータは信用できない、という境目。Web API ではサーバーの入口。
- **Single Source of Truth（信頼できる唯一の情報源）**: ルールの定義を 1 か所に置き、他はそこから派生させること。

## 仕様・注意点

- **ルールが層ごとにずれている**:
  - 「item は 20 文字まで」はフロントにしかない。API を直接叩けば 21 文字以上も登録できる。
  - 「amount ≠ 0」はフロントにない。0 を入力すると送信され、サーバーで 400 になり、汎用エラーだけが表示される（`11-error-handling-strategy.md`）。
- **バックエンドの検証の穴**:
  - `!item` は空文字を弾くが、`item` が文字列かどうかは確認していない（`item: 123` が通る）。
  - `date` が文字列でない場合、`/.../.test(date)` は値を文字列化して判定する。
  - 正規表現は形式だけを見るので `2025-13-45` のような存在しない日付も通る（OpenAPI の `format: date` は意味的に正しい日付を表すが、実装はそこまで見ていない）。
  - `amount` に `NaN` や `Infinity` を JSON で送ることは JSON の仕様上できないので、その点は安全。
- **OpenAPI と実装は自動で同期されない**: スキーマを変えても実装は変わらず、逆も同様です（`14-api-contract-and-types.md`）。
- 4 つの層に同じルールを手で書くと、変更時に必ずどこかを直し忘れます。

## 今後に活かせるポイント

- 「**サーバーは必ず検証する**」はどんなアプリでも譲れない原則。クライアントの検証はおまけ（UX 向上）と考える。
- ルールを **スキーマ（Zod など）1 か所** に定義し、バックエンドの検証・フロントのフォーム検証・API 仕様書をそこから生成/共有するのが理想形。
- HTML の制約検証は無料で使える最初の防衛線。`type="date"`、`type="number"`、`required` を適切に付けるだけでも入力ミスは大きく減る。

## 改善するなら

### 段階 1: バックエンドを Zod スキーマで検証する

このプロジェクトは既に Zod を依存に持っています（`backend/package.json:14`、現状は `env.ts` でのみ使用）。

```ts
// backend/src/schemas/transaction.ts（案）
import { z } from "zod";

export const transactionInputSchema = z.object({
  item: z.string().min(1, "項目は必須です。").max(20, "項目は20文字以内です。"),
  amount: z.number().int().refine((v) => v !== 0, "金額は0以外の数値である必要があります。"),
  date: z.iso.date("日付はYYYY-MM-DD形式で入力してください。"),
});

export type TransactionInput = z.infer<typeof transactionInputSchema>;
```

```ts
// ハンドラ（案）
const parsed = transactionInputSchema.safeParse(await c.req.json());
if (!parsed.success) {
  return c.json({ message: parsed.error.issues[0].message }, 400);
}
```

Hono のバリデーターミドルウェアと組み合わせる方法は Hono フォルダ参照。Zod の API 詳細は TypeScript フォルダ参照。

### 段階 2: スキーマをフロントと共有する

モノレポ化（`03-repository-structure.md`）してスキーマを `packages/shared` に置けば、フロントでも送信前に同じルールで検証でき、ルールのずれがなくなります。

### 段階 3: スキーマから OpenAPI を生成する

`@hono/zod-openapi` などを使うと Zod スキーマから OpenAPI ドキュメントを生成でき、手書きの `openapi.yaml` との二重管理を解消できます（API-Design フォルダ参照）。

## 次に学ぶこと

- **Zod** と **React Hook Form**（`@hookform/resolvers/zod`）によるフォーム検証。
- **スキーマ駆動開発**: スキーマを起点に検証・型・ドキュメントを生成する開発スタイル。
