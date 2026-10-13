# 永続化がない現状と、DB 層・リポジトリ層の追加方針

## 概要

現在のバックエンドは **データを保存していません**。

- GET はハンドラ内に書かれた固定の 1 件を毎回返す。
- POST は検証して、受け取った内容をそのまま返すだけ（どこにも記録しない）。

画面と API の「流れ」を先に作るための **モック（スタブ）段階** と言えます。次の大きな一歩はデータの永続化ですが、そのときに「ハンドラに直接 SQL を書く」のではなく、**データアクセスを専用の層に分ける** と、テストや DB の変更に強い構造になります。

## このプロジェクトでの実装

### GET: 固定データ

```ts
// backend/src/index.ts:30-37
const transactionList = [
  {
    id: 1,
    item: "給料",
    amount: 10000,
    date: "2025-01-01",
  },
];
```

この配列はリクエストのたびに **ハンドラの中で新しく作られる** ので、仮に POST で追加しようとしても次のリクエストでは消えます。また `type` による絞り込みもしていません。

### POST: 保存しない

```ts
// backend/src/index.ts:83
return c.json(body, 201);
```

`201 Created` を返していますが、実際には何も作られていません。OpenAPI の説明にも「受け取った内容をそのまま返します」とあり（`backend/openapi.yaml:50`）、仕様と実装は一致しています。

### ユーザーから見た挙動

1. 登録画面で「支出 / ランチ / 1000 / 今日」を登録 → 成功して Home へ戻る
2. Home の一覧は再取得されるが、**表示されるのは固定の「給料 10000」だけ**
3. 収入カードにも支出カードにも同じ「給料」が出る

## 重要語句

- **永続化（persistence）**: プロセスが終了してもデータが残るように保存すること（DB、ファイルなど）。
- **モック / スタブ**: 本物の代わりに固定の値を返す仮実装。
- **リポジトリパターン**: データの保存・取得を「コレクションのようなインターフェース」の裏に隠すパターン。呼び出し側は DB の種類を知らない。
- **依存性の注入（DI）**: 使う部品（リポジトリなど）を外から渡すこと。テスト時に偽物に差し替えられる。
- **ORM / クエリビルダー**: TypeScript から型安全に DB を操作するライブラリ（Drizzle、Prisma など）。
- **マイグレーション**: DB のテーブル構造の変更を、バージョン管理されたファイルとして適用する仕組み。

## 仕様・注意点

- 現状の 201 応答には `id` が含まれません。永続化すると DB が `id` を採番するので、レスポンスは `Transaction`（id あり）にするのが自然です。その場合 OpenAPI の 201 のスキーマ（`backend/openapi.yaml:60-63`、今は `TransactionInput`）も変更が必要です。
- 合計（`totalAmount`）の計算は今はアプリ側の `reduce`（`backend/src/index.ts:42-45`）ですが、DB を入れれば `SUM()` で DB に計算させることもできます。どちらに置くかは設計判断です。
- 永続化を入れると、同時アクセス・トランザクション・バックアップなど新たな考慮事項が生まれます。

## 今後に活かせるポイント

- 開発初期は「固定データを返す API」で画面とのつなぎ込みを先に完成させ、後から保存処理を差し込む、という進め方は実践的。
- そのとき差し込みやすくするために、**データの出し入れは最初から関数（リポジトリ）の裏に隠す**。
- 段階的に: メモリ上の配列 → ファイル / SQLite → 本番用 DB（PostgreSQL など）と進めても、リポジトリのインターフェースが変わらなければハンドラは無傷。

## 改善するなら

### ステップ 1: インターフェースを決め、メモリ実装を作る

```ts
// backend/src/repositories/transactionRepository.ts（案）
export type Transaction = { id: number; item: string; amount: number; date: string };
export type NewTransaction = Omit<Transaction, "id">;
export type TransactionType = "income" | "expense" | "all";

export interface TransactionRepository {
  list(type: TransactionType): Promise<Transaction[]>;
  create(input: NewTransaction): Promise<Transaction>;
}

export const createInMemoryTransactionRepository = (): TransactionRepository => {
  const rows: Transaction[] = [];   // ハンドラの外にあるので、リクエストをまたいで残る
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

※ メモリ実装はサーバーを再起動すると消えますが、「登録したものが一覧に出る」体験はこれだけで実現できます。

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

### ステップ 3: DB 実装に差し替える

```text
backend/src/
├── db/
│   ├── schema.ts          ← テーブル定義（例: Drizzle）
│   └── client.ts          ← 接続（DATABASE_URL は env.ts で検証）
├── repositories/
│   ├── transactionRepository.ts        ← interface + in-memory 実装
│   └── drizzleTransactionRepository.ts ← DB 実装
└── ...
```

ハンドラ・サービスは `TransactionRepository` インターフェースにだけ依存しているので、`index.ts` で渡す実装を切り替えるだけで済みます。テストではメモリ実装を渡せます（`16-testing-strategy.md`）。

## 次に学ぶこと

- **Drizzle ORM / Prisma** と SQLite・PostgreSQL の基本。
- **リポジトリパターン / ヘキサゴナルアーキテクチャ（ポートとアダプタ）**: インターフェース（ポート）と実装（アダプタ）を分ける考え方。
- **マイグレーション管理**（drizzle-kit など）。
