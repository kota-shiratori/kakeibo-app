# 永続化（PostgreSQL）の現状と、リポジトリ層への分離

## 概要

バックエンドは **PostgreSQL にデータを保存する** ようになりました（初回コミット `068b29e` で `pg` の `Client` により導入済み。`2a1609f` で `Pool` + `DATABASE_URL` に変更）。

- ローカル開発：Docker の PostgreSQL 18.3（`../Docker/`）
- 本番（Vercel Functions）：Neon の PostgreSQL（`../PostgreSQL/08-neon-and-vercel-attach-database-pool.md`）

以前は「GET は固定の 1 件を返す / POST は受け取った値を返すだけ」というモック段階でしたが、現在は POST で `INSERT` し、GET で `SELECT` した結果を返します。

ただし、**SQL はルートハンドラの中に直接書かれています**。動くことは動きますが、テストのしにくさ・責務の混在という課題が残っています。このノートでは現状を整理し、データアクセスを **リポジトリ層** に分ける手順をまとめます。

## このプロジェクトでの実装

### 接続（モジュールのトップレベルで Pool を 1 つ作る）

`backend/src/index.ts:7-8`

```ts
const pool = new Pool({ connectionString: env.DATABASE_URL });
attachDatabasePool(pool);
```

- 接続先は環境変数 `DATABASE_URL`（`backend/src/env.ts:7` で検証）。
- `Pool` はリクエストのたびに作らず、モジュール読み込み時に 1 つだけ作って使い回す（`../PostgreSQL/06-node-postgres-pool-and-query.md`）。
- `attachDatabasePool` は Vercel 上でアイドル接続を閉じきるまで関数を生かしておくためのもの。ローカルでは実質何もしない。

### GET: 条件に応じて SQL を組み立てて SELECT

`backend/src/index.ts:41-61`（抜粋）

```ts
let historyQuery = `SELECT id, item, amount, date FROM transactions`;
let countQuery = `SELECT COUNT(*) as total FROM transactions`;

if (type === "income" || type === "expense") {
  const addTypeQuery =
    type === "income" ? ` WHERE amount > 0` : ` WHERE amount < 0`;
  historyQuery += addTypeQuery;
  countQuery += addTypeQuery;
}

historyQuery += ` ORDER BY date DESC`;

const historyResult = await pool.query(historyQuery);
const countResult = await pool.query(countQuery);

const transactions = historyResult.rows.map((row) => ({
  id: parseInt(row.id),
  item: row.item,
  amount: parseFloat(row.amount),
  date: toYMD(new Date(row.date)),
}));
```

- `type` による絞り込みは **金額の符号**（`amount > 0` / `< 0`）で実現（`09-domain-modeling-signed-amount.md`）。
- 連結しているのは固定の文字列だけで、利用者の入力は SQL に入らないので SQL インジェクションの心配はない（`../SQL/11-placeholders-and-sql-injection.md`）。
- 合計金額は DB の `SUM()` ではなく、アプリ側の `reduce`（63-66 行目）で計算している。

### POST: プレースホルダーで INSERT し、RETURNING で登録結果を返す

`backend/src/index.ts:93-105`

```ts
const result = await pool.query(
  `INSERT INTO transactions (item, amount, date) VALUES ($1, $2, $3) RETURNING id, item, amount, date`,
  [item, amount, date],
);

const newTransaction = {
  id: parseInt(result.rows[0].id),
  item: result.rows[0].item,
  amount: parseFloat(result.rows[0].amount),
  date: toYMD(new Date(result.rows[0].date)),
};

return c.json(newTransaction, 201);
```

- `$1, $2, $3` のプレースホルダーで値を渡している（SQL インジェクション対策）。
- `RETURNING` で DB が採番した `id` を含めて受け取り、201 で返す。以前の「受け取った内容をそのまま返す」から、**本当に作られたリソースを返す** 形になった。

### ユーザーから見た挙動

1. 登録画面で「支出 / ランチ / 1000 / 今日」を登録 → `transactions` に 1 行追加され、Home へ戻る
2. Home の一覧が再取得され、**登録した行が表示される**（`date` の新しい順）
3. 収入カードには `amount > 0`、支出カードには `amount < 0` の行だけが出る
4. backend を再起動しても、データは DB に残る

## 重要語句

- **永続化（persistence）**: プロセスが終了してもデータが残るように保存すること。ここでは PostgreSQL。
- **コネクションプール**: DB への接続を使い回す仕組み。`pg` の `Pool`（`../PostgreSQL/06-node-postgres-pool-and-query.md`）。
- **リポジトリパターン**: データの保存・取得を「コレクションのようなインターフェース」の裏に隠すパターン。呼び出し側は SQL や DB の種類を知らない。
- **依存性の注入（DI）**: 使う部品（リポジトリなど）を外から渡すこと。テスト時にメモリ実装などの偽物に差し替えられる。
- **マッピング**: DB の行（`row`）を、API で返す形（`Transaction`）に変換すること。今は 56-61 行目と 98-103 行目の 2 か所に同じ処理がある。
- **マイグレーション**: テーブル構造の変更を、バージョン管理されたファイルとして適用する仕組み（`../Database/04-migrations-and-schema-management.md`）。

## 仕様・注意点

### 1. ハンドラが 4 つの責務を持っている

GET ハンドラの中に、次のすべてが入っています。

1. HTTP の入力の取り出しと検証（`c.req.query`）
2. SQL の組み立てと実行（`pool.query`）
3. 行から API の形への変換（`parseInt` / `toYMD`）
4. 業務ロジック（合計金額の計算）

`pool` がモジュールのトップレベルにあるため、**ハンドラのテストには必ず本物の DB が必要** です。`app.request()` でテストしようとしても、DB を立ち上げてテーブルを作ってからでないと動きません（`16-testing-strategy.md`）。

### 2. 行の変換処理が重複している

`id` / `amount` / `date` の変換が GET と POST にコピーされています。さらに、

- `parseFloat(row.amount)` は不要（`INTEGER` 列は `pg` が最初から number で返す）
- `parseInt(row.id)` は必要（`BIGINT` は文字列で返る）
- `toYMD` はローカル時刻のメソッドを使っているので正しい（`toISOString()` に変えると日本時間で 1 日ずれる）

という事情があり、詳しくは `../PostgreSQL/07-node-postgres-type-conversion.md` を参照。変換を 1 か所にまとめておかないと、片方だけ直すミスが起きます。

### 3. 一覧と件数で 2 回 SQL を投げている

`totalCount` を別の `COUNT(*)` クエリで取っていますが、絞り込み条件が同じなので `transactions.length` と一致します（間に別の INSERT が挟まるとずれる可能性さえある）。1 クエリで足ります（`../SQL/10-transactions-commit-rollback.md`）。

### 4. DB のエラーがそのまま 500 になる

`item` が 21 文字、`amount` が小数や `INTEGER` の範囲外、`date` が `2025-02-30` などの場合、backend の検証は通過し、DB で制約違反の例外が起き、捕捉されずに **500** が返ります。本来は入力ミスとして 400 にすべきです（`../Database/03-schema-design-for-kakeibo.md`、`../PostgreSQL/05-constraints-and-errors.md`）。

### 5. 仕様（OpenAPI）が追いついていない

`backend/openapi.yaml:50` の説明は「受け取った内容をそのまま返します」、201 のスキーマ（`openapi.yaml:58-63`）は `TransactionInput`（`id` なし）のままです。実装は `id` 付きの `Transaction` を返すので、仕様を `$ref: "#/components/schemas/Transaction"` に直す必要があります（`14-api-contract-and-types.md`）。

### 6. テーブル定義がリポジトリにない

`transactions` テーブルは psql で手作業で作成しており（学習メモ `../SQL/01`）、ローカルと Neon の両方に同じ操作が必要です。`schema.sql` やマイグレーションで管理するのが望ましい（`../Database/04-migrations-and-schema-management.md`）。

## 今後に活かせるポイント

- 「固定データを返す API で画面とのつなぎ込みを先に完成させ、後から保存処理を差し込む」という進め方を取った。API のレスポンスの形（`transactions` / `totalCount` / `totalAmount`）を変えずに中身だけ DB に差し替えられれば、フロントエンドへの影響を小さくできる。
- 次の段階として、**データの出し入れを関数（リポジトリ）の裏に隠す** と、テスト・DB の変更・ハンドラの見通しがすべて良くなる。

## 改善するなら

### ステップ 1: インターフェースを決め、pg 実装を作る

```ts
// backend/src/repositories/transactionRepository.ts（案）
export type Transaction = { id: number; item: string; amount: number; date: string };
export type NewTransaction = Omit<Transaction, "id">;
export type TransactionType = "income" | "expense" | "all";

export interface TransactionRepository {
  list(type: TransactionType): Promise<Transaction[]>;
  create(input: NewTransaction): Promise<Transaction>;
}
```

```ts
// backend/src/repositories/pgTransactionRepository.ts（案）
import type { Pool } from "pg";
import type { Transaction, TransactionRepository, TransactionType } from "./transactionRepository.js";

const toYMD = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// 行 → Transaction の変換を 1 か所に集約する
const toTransaction = (row: { id: string; item: string; amount: number; date: Date }): Transaction => ({
  id: Number(row.id), // BIGINT は文字列で返る
  item: row.item,
  amount: row.amount, // INTEGER は number で返る
  date: toYMD(row.date), // DATE はローカル 0 時の Date で返る
});

const WHERE_BY_TYPE: Record<TransactionType, string> = {
  income: "WHERE amount > 0",
  expense: "WHERE amount < 0",
  all: "",
};

export const createPgTransactionRepository = (pool: Pool): TransactionRepository => ({
  async list(type) {
    const result = await pool.query(
      `SELECT id, item, amount, date FROM transactions ${WHERE_BY_TYPE[type]} ORDER BY date DESC, id DESC`,
    );
    return result.rows.map(toTransaction);
  },
  async create({ item, amount, date }) {
    const result = await pool.query(
      `INSERT INTO transactions (item, amount, date) VALUES ($1, $2, $3) RETURNING id, item, amount, date`,
      [item, amount, date],
    );
    return toTransaction(result.rows[0]);
  },
});
```

- `ORDER BY date DESC, id DESC` で、同じ日付の行の順番も決まるようにする（`../SQL/07-order-by.md`）。
- 件数用の `COUNT(*)` クエリはなくし、`length` で数える。

### ステップ 2: サービス層で業務ロジックをまとめる

```ts
// backend/src/services/transactionService.ts（案）
export const createTransactionService = (repo: TransactionRepository) => ({
  async list(type: TransactionType) {
    const transactions = await repo.list(type);
    return {
      transactions,
      totalCount: transactions.length,
      totalAmount: transactions.reduce((s, t) => s + t.amount, 0),
    };
  },
  create: (input: NewTransaction) => repo.create(input),
});
```

### ステップ 3: app を「リポジトリを受け取って作る」形にする

```ts
// backend/src/app.ts（案）
export const createApp = (repo: TransactionRepository) => {
  const service = createTransactionService(repo);
  const app = new Hono();
  // ... cors、ルート定義（service を呼ぶだけ）
  return app;
};

// backend/src/index.ts（本番・ローカル共通のエントリ）
const pool = new Pool({ connectionString: env.DATABASE_URL });
attachDatabasePool(pool);
export default createApp(createPgTransactionRepository(pool));
```

```text
backend/src/
├── app.ts                         ← createApp(repo)：ルート定義
├── index.ts                       ← Pool を作って createApp に渡す（Vercel のエントリ）
├── dev.ts                         ← ローカル起動（今のまま）
├── env.ts
├── services/
│   └── transactionService.ts
└── repositories/
    ├── transactionRepository.ts   ← interface（+ テスト用のメモリ実装）
    └── pgTransactionRepository.ts ← pg 実装
```

テストではメモリ上の配列で動く実装を `createApp` に渡せば、DB なしでハンドラを検証できます（`16-testing-strategy.md`）。

```ts
// テスト用のメモリ実装（案）
export const createInMemoryTransactionRepository = (): TransactionRepository => {
  const rows: Transaction[] = [];
  let nextId = 1;
  return {
    async list(type) {
      if (type === "income") return rows.filter((t) => t.amount > 0);
      if (type === "expense") return rows.filter((t) => t.amount < 0);
      return rows;
    },
    async create(input) {
      const row = { id: nextId++, ...input };
      rows.push(row);
      return row;
    },
  };
};
```

### ステップ 4: 周辺を整える

1. 入力検証を DB の型・制約に揃え、DB エラーで 500 にならないようにする（`12-validation-layers.md`、`../Database/03-schema-design-for-kakeibo.md`）
2. OpenAPI の 201 のスキーマを `Transaction` に直す（`14-api-contract-and-types.md`）
3. テーブル定義を `schema.sql` / マイグレーションとしてリポジトリに置く（`../Database/04-migrations-and-schema-management.md`）

## 次に学ぶこと

- **Drizzle ORM / Prisma**：SQL の結果に型を付け、行の変換やスキーマ管理をツールに任せる選択肢。
- **リポジトリパターン / ヘキサゴナルアーキテクチャ（ポートとアダプタ）**：インターフェース（ポート）と実装（アダプタ）を分ける考え方。
- **テスト用 DB**：リポジトリの pg 実装そのものは、Docker の PostgreSQL を使った結合テストで確かめる。
