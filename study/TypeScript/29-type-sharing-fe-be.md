# フロントエンドとバックエンドの型の二重定義（型共有の課題）

## 概要

このプロジェクトでは、同じ「取引（Transaction）」というデータの形が **3 か所で別々に** 表現されています。

1. web-app の TypeScript の型（`web-app/src/hooks/transactions.ts`）
2. backend のコード（型定義は無く、オブジェクトリテラルから推論されるだけ）
3. API 仕様書 `backend/openapi.yaml`

これらは互いに参照し合っていないので、どれか 1 つを変更しても **他がずれたことを TypeScript は検出できません**。フロントエンドとバックエンドを両方 TypeScript で書く大きな利点の 1 つは「型を共有できること」ですが、現状はまだそれを活かしていない状態です。

## このプロジェクトでの実装

### 1. web-app の型

`web-app/src/hooks/transactions.ts:1`

```ts
export type Transaction = {
  id: number;
  item: string;
  amount: number;
  date: string;
};

export type TransactionListInfo = {
  transactions: Transaction[];
  totalCount: number;
  totalAmount: number;
};

export type NewTransaction = Omit<Transaction, "id">;
```

`web-app/src/pages/Input.tsx:17`

```ts
type TransactionType = "income" | "expense";
```

### 2. backend のコード

`backend/src/index.ts:56-72`

```ts
const transactions = historyResult.rows.map((row) => ({
  id: parseInt(row.id),
  item: row.item,
  amount: parseFloat(row.amount),
  date: toYMD(new Date(row.date)),
}));

const result = {
  transactions,
  totalCount: parseInt(countResult.rows[0].total),
  totalAmount,
};
```

以前はハンドラ内の固定配列（`{ id: 1, item: "給料", ... }`）を返していましたが、現在は PostgreSQL から読んだ行を変換して返します。型注釈は無く、`row` は `pg` の型定義上 `any` なので（→ `17-any-propagation.md`）、`item: row.item` も `date` 以外は推論が効かず、`transactions` は `{ id: number; item: any; amount: number; date: string }[]` のような型になります（`parseInt` / `parseFloat` / `toYMD` の戻り値の型だけが付く）。POST の入力は `c.req.json()` 由来で `any`、登録結果も `result.rows[0]`（`any`）から組み立てています（`backend/src/index.ts:93-105`）。クエリの種別は文字列配列 `["income", "expense", "all"]` でチェックされています（`backend/src/index.ts:32`）。

さらに、型とは別に **DB のテーブル定義**（`item VARCHAR(20)`、`amount INTEGER` など）という 4 つ目の「形の定義」が加わりました（`../Database/03-schema-design-for-kakeibo.md`）。

### 3. OpenAPI 仕様

`backend/openapi.yaml:94` 以降に `TransactionInput`、`Transaction`（`:120`）、`TransactionListResponse`（`:133`）が定義され、`:80` 以降の `TransactionType` パラメータで `type` クエリが `enum: [income, expense, all]` と定義されています。POST の 201 レスポンスは `TransactionInput`（`id` なし）を指したままですが（`:58-63`）、実装は DB が採番した `id` 付きの値を返すようになったので、ここもずれています。

### 対応関係とずれ

| 概念 | web-app | backend | openapi.yaml |
| --- | --- | --- | --- |
| 取引 | `Transaction` | 推論のみ（DB の行は `any`） | `Transaction`（`id` は `integer`） |
| 一覧レスポンス | `TransactionListInfo` | `result` の推論型 | `TransactionListResponse` |
| 登録入力 | `NewTransaction` | `any`（手書き検証） | `TransactionInput` |
| 登録結果（201） | `useAddTransactions` は本文を使っていない | `id` 付きの推論型 | `TransactionInput`（`id` なし。ずれ） |
| 種別 | `"income" \| "expense"`（`Input.tsx` 内） | `string`（配列でチェック） | `income / expense / all` |

- 名前が場所ごとに違います（`TransactionListInfo` と `TransactionListResponse`、`NewTransaction` と `TransactionInput`）。
- たとえば backend で `item` を `title` に変えても、web-app のビルドは通り、実行時に初めて表示が壊れます。web-app 側は `response.json() as TransactionListInfo`（`useIncomeTransactions.ts:19`）で検証していないので、壊れ方も分かりにくくなります。

## 重要語句

| 用語 | 意味 |
| --- | --- |
| Single Source of Truth | 情報の正となる定義を 1 か所にし、他はそこから派生させる原則 |
| 型共有 | フロントエンドとバックエンドで同じ型定義を参照すること |
| モノレポ | 複数のパッケージ（web-app / backend / shared）を 1 つのリポジトリで管理する構成 |
| コード生成 | OpenAPI などの仕様書から型やクライアントコードを自動生成すること |
| `z.infer` | Zod スキーマから TypeScript の型を取り出すユーティリティ型 |

## 仕様・注意点

- **型を共有しても、実行時の保証にはなりません。** 共有された型はあくまでコンパイル時の約束で、実際のレスポンスがその形かはランタイム検証で確認する必要があります（→ `14-runtime-validation.md`）。型共有とランタイム検証はセットで考えます。
- **web-app と backend で tsconfig が違います**（以前は 6.0 + `bundler` / 7.0 + `NodeNext`。現在はバージョンは両方 6.0.3 に揃ったが、`bundler` / `NodeNext` の違いは残っている）。共有パッケージを作る場合、両方の設定で問題なく読める書き方（相対 import に拡張子を付ける、型だけのファイルにする、など）が必要です。
- 共有する型には、ブラウザ専用・Node.js 専用の API を含めないようにします。

## 今後に活かせるポイント

型共有の代表的な方法（どれを選ぶかは Architecture / API-Design / Hono の各ノートとあわせて検討してください）:

| 方法 | 正となるもの | 概要 |
| --- | --- | --- |
| 共有パッケージ | TS の型 or Zod スキーマ | `packages/shared` を作り、両方から import する（npm/pnpm workspaces） |
| Zod スキーマ共有 | Zod スキーマ | スキーマから `z.infer` で型を生成し、backend ではリクエスト検証、web-app ではレスポンス検証に使う |
| OpenAPI からコード生成 | `openapi.yaml` | `openapi-typescript` などで型を生成する。仕様書が既にあるこのプロジェクトと相性が良い |
| Hono RPC | backend のコード | backend のルート定義の型（`typeof app`）を web-app が import し、`hc` クライアントで型付きリクエストを行う（詳細は Hono フォルダの担当範囲） |

## 改善するなら

一例として、Zod スキーマを共有パッケージに置く構成です（ディレクトリ構成やパッケージ管理は Architecture / Tooling の担当範囲なので、ここでは型の流れだけ示します）。

```ts
// packages/shared/src/transaction.ts
import { z } from "zod";

export const transactionTypeSchema = z.enum(["income", "expense"]);
export type TransactionType = z.infer<typeof transactionTypeSchema>; // "income" | "expense"

export const newTransactionSchema = z.object({
  item: z.string().min(1),
  amount: z.number().refine((n) => n !== 0),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export type NewTransaction = z.infer<typeof newTransactionSchema>;

export const transactionSchema = newTransactionSchema.extend({ id: z.number().int() });
export type Transaction = z.infer<typeof transactionSchema>;

export const transactionListSchema = z.object({
  transactions: z.array(transactionSchema),
  totalCount: z.number().int(),
  totalAmount: z.number(),
});
export type TransactionListInfo = z.infer<typeof transactionListSchema>;
```

```ts
// backend: リクエストの検証
const parsed = newTransactionSchema.safeParse(await c.req.json());

// web-app: レスポンスの検証（as を使わない）
const data = transactionListSchema.parse(await response.json());
```

これで「スキーマを変えると、backend と web-app の両方で型エラーが出る」状態になり、ずれをコンパイル時に検出できます。

## 次に学ぶこと

- `z.infer` / `z.input` / `z.output` の違い（`transform` を使う場合）
- openapi-typescript / Orval などのコード生成ツール
- Hono RPC（`hc<AppType>`）と型推論
- npm / pnpm workspaces と TypeScript のプロジェクト参照（→ `24-tsconfig-project-references.md`）
