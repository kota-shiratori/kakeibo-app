# Database 学習ノート

家計簿アプリ（kakeibo-app）にデータベース（PostgreSQL）を導入したことをきっかけに、**特定の製品や文法に依らない「データベースの考え方」** をまとめたノートです。

- 題材: `transactions` テーブル（学習メモ `../SQL/01` の `CREATE TABLE`）と `backend/src/index.ts`
- 実験環境: PostgreSQL 18.3（Docker イメージ `postgres:18.3`）、`pg` 8.23.1
- SQL の文法は `../SQL/`、PostgreSQL 固有の機能（データ型・IDENTITY・node-postgres）は `../PostgreSQL/`、DB の起動方法は `../Docker/` を参照してください。
- backend の中で DB アクセスをどう配置するか（リポジトリ層など）は `../Architecture/15-persistence-and-repository-layer.md` を参照してください。

## 目次（学習順）

| # | ノート | 内容 |
| --- | --- | --- |
| 01 | [データベースとは何か](./01-what-is-a-database.md) | DBMS・RDB・データベース / スキーマ / テーブル / 行 / 列、なぜメモリではなく DB に保存するのか |
| 02 | [主キーとインデックス](./02-keys-and-indexes.md) | 代理キーとしての `id`、自動で作られる `transactions_pkey`、インデックスが必要になるとき |
| 03 | [家計簿のテーブル設計を見直す](./03-schema-design-for-kakeibo.md) | フロント・OpenAPI・backend・DB のルールのずれ、CHECK 制約、将来の拡張 |
| 04 | [スキーマ管理とマイグレーション](./04-migrations-and-schema-management.md) | 手で打った `CREATE TABLE` をリポジトリで管理し、ローカルと本番を揃える |

## このノートで見つかった主な改善ポイント（まとめ）

1. `item` 21 文字・小数や範囲外の `amount`・実在しない日付が backend の検証を通過し、DB でエラーになって **500** が返る → backend の検証を DB の型・制約に揃えて 400 にする（03 章）
2. `amount <> 0` は backend でしか守られていない → DB に CHECK 制約を足す（03 章）
3. テーブル定義がリポジトリにない → `schema.sql` → マイグレーションへ（04 章）
4. 一覧の `ORDER BY date DESC` は同じ日付の並びが不定 → `ORDER BY date DESC, id DESC`（03 章、`../SQL/07-order-by.md`）
