# PostgreSQL とは

## 概要

PostgreSQL（ポストグレスキューエル、通称 Postgres）は、オープンソースの **リレーショナルデータベース管理システム（RDBMS）** です。データを「テーブル（表）」に保存し、SQL で読み書きします。

家計簿アプリでは、これまでハンドラ内の固定データを返していた backend が、PostgreSQL の `transactions` テーブルを読み書きするようになりました。

## このプロジェクトでの実装

PostgreSQL は **2 か所** で動いています。

| 環境 | どこで動くか | 接続のしかた |
| --- | --- | --- |
| ローカル開発 | Docker コンテナ `kakeibo-postgres`（イメージ `postgres:18.3`） | `docker exec ... psql` / backend から `localhost:5432` |
| 本番（Vercel） | Neon（マネージドな PostgreSQL サービス） | 環境変数 `DATABASE_URL` の接続文字列 |

backend 側は **どちらでも同じコード** で、接続先は環境変数で切り替えます。

`backend/src/index.ts:7`

```ts
const pool = new Pool({ connectionString: env.DATABASE_URL });
```

`backend/src/env.ts:7` で `DATABASE_URL: z.string()` として必須にしています。

### 実験で確認: バージョンとタイムゾーン

```text
postgres=# SELECT version();
 PostgreSQL 18.3 (Debian 18.3-1.pgdg13+1) on aarch64-unknown-linux-gnu, ...

postgres=# SHOW TimeZone;
 Etc/UTC
```

Docker 公式イメージのサーバーのタイムゾーンは UTC でした（`DATE` 型はタイムゾーンを持たないので、このアプリの日付には影響しません → 03 章）。

### 実験で確認: データベース一覧

```text
    Name    |  Owner   | Encoding | Locale Provider |  Collate   |   Ctype
------------+----------+----------+-----------------+------------+------------
 kakeibo_db | postgres | UTF8     | libc            | en_US.utf8 | en_US.utf8
 postgres   | postgres | UTF8     | libc            | en_US.utf8 | en_US.utf8
 template0  | postgres | UTF8     | ...
 template1  | postgres | UTF8     | ...
```

- `postgres`: 初期化時に作られる既定の DB。`psql -U postgres` で `-d` を省略するとここにつながる（DB 名の既定値はユーザー名と同じ）。
- `template0` / `template1`: `CREATE DATABASE` の雛形。新しい DB は `template1` のコピーとして作られる。
- `kakeibo_db`: 自分で `CREATE DATABASE kakeibo_db;` した DB。エンコーディングは UTF8 なので日本語をそのまま保存できる。

## 重要語句

| 用語 | 意味 |
| --- | --- |
| RDBMS | テーブルとテーブルの関係（リレーション）でデータを管理する DB ソフト |
| クラスタ（database cluster） | 1 つの PostgreSQL サーバーが管理する DB の集まり。`kakeibo_db` も `postgres` も同じクラスタの中 |
| データベース | クラスタの中の独立した入れ物。接続は 1 つの DB に対して行う |
| スキーマ | DB の中の名前空間。指定しなければ `public`（`\dt` の `Schema` 列） |
| ロール（ユーザー） | 接続・権限の単位。`postgres` は初期化時に作られるスーパーユーザー |
| psql | PostgreSQL 付属の対話型クライアント（→ 02 章） |
| Neon | サーバーレス向けのマネージド PostgreSQL サービス（→ 08 章） |

## 仕様・注意点

- 「データベース」と「スキーマ」は別物です。MySQL の「データベース」は PostgreSQL の「スキーマ」に近い概念です。
- 1 つの接続から **別の DB のテーブルは直接参照できません**。DB を切り替えるには接続し直します（psql なら `\c`）。
- ローカルと本番でメジャーバージョンが違うと、使える機能に差が出ることがあります。Neon 側のバージョンは Neon のダッシュボードで確認してください（未確認）。

## 今後に活かせるポイント

- 「接続先は環境変数、コードは共通」にしておくと、ローカル Docker → Neon、将来別サービスへの移行もコードを変えずにできる。
- ローカルと本番で **同じテーブル定義** を作る必要がある。手で `CREATE TABLE` すると差が出やすいので、SQL ファイルやマイグレーションで管理する（`../Database/04-migrations-and-schema-management.md`）。

## 次に学ぶこと

- psql の操作（→ 02 章）
- コンテナの立て方（`../Docker/03-docker-run-options.md`）
