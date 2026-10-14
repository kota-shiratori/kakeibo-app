# PostgreSQL 学習ノート

家計簿アプリ（kakeibo-app）で使っている **PostgreSQL そのもの** と、Node.js から接続するドライバ **node-postgres（`pg`）**、本番の **Neon + Vercel Functions** での使い方についてまとめたノートです。

- 対象バージョン（確認済み）:
  - PostgreSQL 18.3（Docker イメージ `postgres:18.3`。`SELECT version();` で `PostgreSQL 18.3 (Debian 18.3-1.pgdg13+1)` を確認）
  - `pg` 8.23.1 / `pg-pool` 3.14.0 / `pg-types` 2.2.0（`backend/node_modules` の package.json で確認）
  - `@vercel/functions` 3.10.0
- 記載している挙動の多くは、ローカルの `kakeibo-postgres` コンテナ上の **使い捨て DB / 一時テーブル** と、`backend/node_modules/pg` を使った Node スクリプトで実験して確認しています（「実験で確認」と書いた箇所）。
- SQL 文法そのもの（SELECT / WHERE / UPDATE など）は `../SQL/`、コンテナの起動は `../Docker/`、テーブル設計やキーの考え方は `../Database/` を参照してください。

## 目次（学習順）

| # | ノート | 内容 |
| --- | --- | --- |
| 01 | [PostgreSQL とは](./01-postgresql-overview.md) | RDBMS としての位置づけ、ローカル（Docker）と本番（Neon）の 2 つの PostgreSQL |
| 02 | [psql のメタコマンド](./02-psql-meta-commands.md) | `\l` `\c` `\dt` `\d` `\q` `\x` など、プロンプト `=#` / `-#` の意味 |
| 03 | [データ型](./03-data-types.md) | `BIGINT` / `INTEGER` / `VARCHAR(n)` / `DATE` / `NUMERIC` の範囲と選び方 |
| 04 | [IDENTITY 列（自動採番）](./04-identity-columns.md) | `GENERATED ALWAYS AS IDENTITY`、`BY DEFAULT` / `SERIAL` との違い、欠番 |
| 05 | [制約とエラー（SQLSTATE）](./05-constraints-and-errors.md) | NOT NULL・長さ・範囲違反のエラーメッセージとコード、API で 500 になる問題 |
| 06 | [node-postgres の Pool と query](./06-node-postgres-pool-and-query.md) | `Pool` の既定値、`pool.query`、`$1` プレースホルダー、`RETURNING` |
| 07 | [node-postgres の型変換](./07-node-postgres-type-conversion.md) | `BIGINT`/`COUNT` は文字列、`DATE` はローカル 0 時の `Date`、`toYMD` が正しい理由 |
| 08 | [Neon と `attachDatabasePool`](./08-neon-and-vercel-attach-database-pool.md) | サーバーレスでの接続管理、`@vercel/functions` の実装を読む |

## このノートで見つかった主な改善ポイント（まとめ）

1. DB の制約違反（21 文字の `item`、`INTEGER` 範囲外、小数の `amount`）がそのまま例外になり、API が 500 を返す → 事前に検証して 400 にする（05 章）
2. 一覧取得で SELECT と COUNT の 2 クエリを投げている → 件数は `rows.length` か 1 クエリで十分（06 章）
3. `parseFloat(row.amount)` は不要（`INTEGER` は最初から number）。`BIGINT` の `id` / `COUNT(*)` だけ変換が必要（07 章）
4. `toYMD` はタイムゾーンに依存せず正しく動くが、`toISOString().slice(0, 10)` に置き換えると JST で 1 日ずれる（07 章）
5. ローカルの `backend/.env` に `DATABASE_URL` がまだない → Docker の DB の接続文字列を追加する（06 章 / `../Docker/08-connecting-backend-to-local-db.md`）
6. OpenAPI の POST 201 のスキーマが `TransactionInput`（id なし）のまま → 実装は `RETURNING` で id を返しているので `Transaction` にする（06 章）
