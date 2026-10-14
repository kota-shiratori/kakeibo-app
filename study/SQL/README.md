# SQL 学習ノート

家計簿アプリ（kakeibo-app）の `transactions` テーブルを題材に、**SQL の基本文法** について学んだことをまとめたノートです。学習メモ（`./01`）で psql に打った SQL と、backend（`backend/src/index.ts`）が実行している SQL をもとに整理しています。

- 対象バージョン: PostgreSQL 18.3（Docker イメージ `postgres:18.3`）で実験
- 記載している挙動の多くは、コンテナ `kakeibo-postgres` に実験用データベース（`study_scratch`、実験後に削除）を作って実行し、確認しています。node-postgres（`pg` 8.23.1）経由の挙動は backend の `node_modules` を使って確認しました。
- PostgreSQL 固有の話（psql のメタコマンド、データ型、IDENTITY 列、node-postgres の型変換、Neon）は `../PostgreSQL/`、データベースの概念（テーブル設計・キー・マイグレーション）は `../Database/`、Docker でのコンテナ起動は `../Docker/` を参照してください。

## 目次（学習順）

| # | ノート | 内容 |
| --- | --- | --- |
| 01 | [SQL の命令の分類](./01-sql-categories.md) | DDL / DML / DCL / TCL と、backend が実行しているのは DML だけであること |
| 02 | [SQL の書き方の基本ルール](./02-sql-syntax-basics.md) | `'値'` と `"名前"` の違い、`''2025-10-02` のエラー、大文字小文字、`;`、コメント |
| 03 | [`CREATE DATABASE` / `CREATE TABLE`](./03-create-database-and-table.md) | kakeibo_db と transactions テーブルの作成、`\d` の読み方、テーブル定義がファイルに残っていない問題 |
| 04 | [行の追加 `INSERT`](./04-insert.md) | 複数行 INSERT、`RETURNING`、学習メモのカッコの位置の誤り、制約違反と id の欠番 |
| 05 | [`SELECT` と `WHERE`](./05-select-and-where.md) | 列の選択、比較演算子、期間は「以上・未満」で書く、backend の動的 WHERE |
| 06 | [`AND` と `OR` の優先順位](./06-and-or-precedence.md) | 全体をカッコで囲んでも直らない理由を実データで確認、`IN` の活用 |
| 07 | [並び替え `ORDER BY`](./07-order-by.md) | ASC / DESC、同じ日付の行の順番が決まらない問題と `id DESC` の追加 |
| 08 | [`UPDATE` と `DELETE`](./08-update-and-delete.md) | 式を使った更新、`UPDATE 0`、`WHERE` なしの全件削除、削除 API の例 |
| 09 | [集計関数と `GROUP BY`](./09-aggregate-functions-and-group-by.md) | `COUNT` / `SUM` / `AVG` / `MAX` / `MIN` の結果の型、0 件で NULL、月別集計 |
| 10 | [トランザクション](./10-transactions-commit-rollback.md) | `BEGIN` / `COMMIT` / `ROLLBACK`、エラー後の中断状態、Pool では同じ接続で実行する |
| 11 | [プレースホルダーと SQL インジェクション](./11-placeholders-and-sql-injection.md) | `$1` の仕組み、連結すると全件ヒットする実験、値以外はプレースホルダーにできない |

## このノートで見つかった主な改善ポイント（まとめ）

1. `AND` と `OR` を混ぜた条件は、`OR` 側をカッコで囲むか `IN` を使う。全体を囲んでも意味は変わらない（06 章）
2. `ORDER BY date DESC` だけでは同じ日付の行の順番が不定 → `ORDER BY date DESC, id DESC`（07 章）
3. `COUNT(*)` / `SUM` は bigint で文字列として届く。`SUM` は 0 件で NULL → `parseInt` / `COALESCE` を忘れない（09 章）
4. 一覧と件数を別の SQL で取っているので、全件取得の現状では件数の SQL は不要（`length` で足りる）（09, 10 章）
5. テーブル定義（`CREATE TABLE`）がファイルとして残っていない → スキーマを SQL ファイル / マイグレーションで管理する（03 章）
6. DB の制約違反（21 文字の項目名、範囲外の金額など）が backend で 500 になる → バリデーションの追加と DB エラーの変換（04, 11 章、`../PostgreSQL/05-constraints-and-errors.md`）
7. OpenAPI の 201 レスポンスが id なしの `TransactionInput` のまま → `RETURNING` で id を返している実装に合わせて `Transaction` に（04 章）

## 学習メモ（原文）

`./01` は psql で手を動かしながら書いた元のメモです。このノートはそれを整理・検証したもので、メモ内の誤り（`''2025-10-02`、`INSERT` のカッコの位置）は各章で修正版を示しています。
