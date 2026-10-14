# SQL の命令の分類（DDL / DML / DCL / TCL）

## 概要

SQL（Structured Query Language）は、リレーショナルデータベース（RDB）を操作するための言語です。命令は役割ごとに大きく 4 つに分けて説明されることが多く、「いま自分が書いているのは **構造** を変える命令か、**データ** を変える命令か」を意識すると、影響範囲や危険度を判断しやすくなります。

※ この 4 分類は学習用に広く使われる分け方で、SQL 標準や PostgreSQL のマニュアルがこの名前で章立てしているわけではありません。

## このプロジェクトでの実装

学習メモ（`study/SQL/01`）で使った命令を分類すると次のようになります。

| 分類 | 使った命令 | どこで使ったか |
| --- | --- | --- |
| DDL | `CREATE DATABASE kakeibo_db;` / `CREATE TABLE transactions (...)` | psql で手動実行（→ 03 章） |
| DML | `INSERT` / `SELECT` / `UPDATE` / `DELETE` | psql での練習（→ 04〜09 章）、backend のコード |
| TCL | `BEGIN` / `COMMIT` / `ROLLBACK` | 実験で確認（→ 10 章） |
| DCL | `GRANT` / `REVOKE` | まだ使っていない |

backend（`backend/src/index.ts`）が実行しているのは **DML だけ** です。

- 41-42 行目: `SELECT ... FROM transactions` / `SELECT COUNT(*) ...`
- 93-96 行目: `INSERT INTO transactions ... RETURNING ...`

テーブルを作る DDL はアプリのコードには含まれておらず、psql で手で実行しただけになっています（→ `../Database/04-migrations-and-schema-management.md`）。

## 重要語句

| 分類 | 正式名 | 役割 | 主な命令 |
| --- | --- | --- | --- |
| **DDL** | Data Definition Language（データ定義言語） | テーブルなど「入れ物の構造」を定義・変更・削除 | `CREATE` / `ALTER` / `DROP`（`TRUNCATE` を含める説明もある） |
| **DML** | Data Manipulation Language（データ操作言語） | 行（データ）の取得・追加・更新・削除 | `SELECT` / `INSERT` / `UPDATE` / `DELETE` |
| **DCL** | Data Control Language（データ制御言語） | ユーザー（ロール）への権限の付与・剥奪 | `GRANT` / `REVOKE` |
| **TCL** | Transaction Control Language（トランザクション制御言語） | 複数の操作をひとまとまりとして確定・取り消し | `BEGIN` / `COMMIT` / `ROLLBACK` / `SAVEPOINT` |

- **CRUD**: Create / Read / Update / Delete の頭文字。DML の `INSERT` / `SELECT` / `UPDATE` / `DELETE` と、REST の `POST` / `GET` / `PUT`(`PATCH`) / `DELETE` にそれぞれ対応させて説明されることが多い（→ `../API-Design/01-rest-basics.md`）。
- `SELECT` は「データを変更しない」ので、DML とは別に **DQL**（Data Query Language）と分ける説明もあります。

## 仕様・注意点

- **DDL は影響が大きい**: `DROP TABLE transactions;` はテーブルごとデータを消します。`ALTER TABLE` は既存データを持つテーブルの構造を変えるので、本番では手順（マイグレーション）として管理するのが普通です。
- **PostgreSQL では DDL もトランザクションの中で実行でき、`ROLLBACK` で取り消せます**（MySQL などでは DDL が暗黙にコミットされるものがあり、ここは DBMS ごとに違います）。ただし `CREATE DATABASE` / `DROP DATABASE` はトランザクションブロックの中では実行できません。
- DCL はこのプロジェクトではまだ出てきません。ローカルの Docker でも Neon でも、今は強い権限を持つユーザーでつないでいます。本番ではアプリ用に必要な権限だけを持つロールを作るのが望ましい（最小権限の原則）。

## 今後に活かせるポイント

- SQL を書く前に「これは DDL / DML / DCL / TCL のどれか」を一瞬考えると、`WHERE` の付け忘れや本番 DB での `DROP` など、取り返しのつかない操作に気付きやすくなります。
- アプリのコードが実行するのは原則 DML。DDL はマイグレーション、DCL は DB 管理側、という役割分担を意識する。

## 次に学ぶこと

- SQL の書き方の基本ルール（→ 02 章）
- `CREATE TABLE` の詳細（→ 03 章）
- トランザクション（→ 10 章）
