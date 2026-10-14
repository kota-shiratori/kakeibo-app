# データベースとテーブルの作成 `CREATE DATABASE` / `CREATE TABLE`

## 概要

PostgreSQL のサーバー（Docker で動かしているコンテナ）の中には、複数の **データベース** を作れます。データベースの中に **テーブル** を作り、テーブルに **行** を入れていく、という入れ子の関係です（用語は `../Database/01-what-is-a-database.md`）。

```text
PostgreSQL サーバー（コンテナ kakeibo-postgres）
├── postgres      ← 初期状態からあるデータベース
├── kakeibo_db    ← 今回作ったデータベース
│   └── public（スキーマ）
│       └── transactions（テーブル）
├── template0 / template1  ← 新しい DB を作るときのひな形
```

## このプロジェクトでの実装

### 1. データベースを作る

psql で `postgres` データベースに接続した状態で実行しました。

```sql
CREATE DATABASE kakeibo_db;
```

```text
\l   -- データベース一覧を表示（psql のメタコマンド）
\q   -- psql を終了
```

実験で確認した `\l` の結果（抜粋）:

```text
    Name    |  Owner   | Encoding | ...
------------+----------+----------+----
 kakeibo_db | postgres | UTF8     |
 postgres   | postgres | UTF8     |
 template0  | postgres | UTF8     |
 template1  | postgres | UTF8     |
```

その後、`docker exec -it kakeibo-postgres psql -U postgres -d kakeibo_db` で **kakeibo_db に接続し直して** からテーブルを作っています（`-d` で接続先 DB を指定。psql の中なら `\c kakeibo_db` でも切り替えられる）。

### 2. テーブルを作る

```sql
CREATE TABLE transactions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    item VARCHAR(20) NOT NULL,
    amount INTEGER NOT NULL,
    date DATE NOT NULL
);
```

| 列 | 型 | 制約・設定 | 意味 |
| --- | --- | --- | --- |
| `id` | `BIGINT`（8 バイト整数） | `GENERATED ALWAYS AS IDENTITY` / `PRIMARY KEY` | DB が自動で採番する主キー |
| `item` | `VARCHAR(20)` | `NOT NULL` | 項目名（最大 20 文字） |
| `amount` | `INTEGER`（4 バイト整数） | `NOT NULL` | 金額。支出はマイナス（→ `../Architecture/09-domain-modeling-signed-amount.md`） |
| `date` | `DATE` | `NOT NULL` | 日付（時刻なし） |

作成後の確認（学習メモに貼った出力）:

```text
kakeibo_db=# \dt
              List of tables
 Schema |     Name     | Type  |  Owner
--------+--------------+-------+----------
 public | transactions | table | postgres
(1 row)
```

```text
kakeibo_db=# \d transactions
                             Table "public.transactions"
 Column |         Type          | Collation | Nullable |           Default
--------+-----------------------+-----------+----------+------------------------------
 id     | bigint                |           | not null | generated always as identity
 item   | character varying(20) |           | not null |
 amount | integer               |           | not null |
 date   | date                  |           | not null |
Indexes:
    "transactions_pkey" PRIMARY KEY, btree (id)
```

読み取れること:

- `VARCHAR(20)` は正式名 `character varying(20)` と表示される。
- `PRIMARY KEY` を付けただけで `transactions_pkey` という **インデックス**（btree）が自動で作られている（→ `../Database/02-keys-and-indexes.md`）。
- テーブル名に `public.` が付いている。スキーマを指定しないと `public` スキーマに作られる。

backend はこのテーブルを前提にしています（`backend/src/index.ts:41` の `SELECT id, item, amount, date FROM transactions`、93-96 行目の `INSERT`）。

## 重要語句

- **データベース**: テーブルなどをまとめた単位。接続はデータベース単位（接続文字列の末尾 `/kakeibo_db` がこれ）。
- **スキーマ**: データベースの中の名前空間。既定は `public`。
- **テーブル / 列（カラム） / 行（レコード）**: 表・その縦の項目・横の 1 件。
- **制約（constraint）**: 列に入る値のルール。`NOT NULL`、`PRIMARY KEY` など（→ `../PostgreSQL/05-constraints-and-errors.md`）。

## 仕様・注意点

- **型ごとの範囲・挙動** は `../PostgreSQL/03-data-types.md`、**`GENERATED ALWAYS AS IDENTITY`** の詳細は `../PostgreSQL/04-identity-columns.md` にまとめています。
- 同じ名前のテーブルがあると `CREATE TABLE` はエラーになります。`CREATE TABLE IF NOT EXISTS ...` と書くと、既にあれば何もしません（ただし既存テーブルの構造が違っても気付けない点に注意）。
- 列名 `date` は型名と同じ単語ですが、PostgreSQL ではそのまま列名として使えています（実験でも問題なく動作）。ただし紛らわしいので、`transaction_date` などにする選択肢もあります。
- `CREATE DATABASE` はトランザクションブロック（`BEGIN` 〜）の中では実行できません。
- **今のテーブル定義はどこにもファイルとして残っていません**。Neon（本番）とローカルで同じテーブルを作るには、この `CREATE TABLE` をファイルで管理する必要があります（→ `../Database/04-migrations-and-schema-management.md`）。

## 今後に活かせるポイント

- テーブルを作ったら `\d テーブル名` で **実際にどう定義されたか** を必ず確認する。型の正式名・既定値・インデックスまで見える。
- 入力のルール（20 文字まで、必須、など）は DB の制約としても持たせておくと、アプリのバグがあっても不正なデータが入らない最後の砦になります。

## 改善するなら

DB 側にも業務ルールを持たせる案（`CHECK` 制約。詳細は `../PostgreSQL/05-constraints-and-errors.md`）:

```sql
CREATE TABLE transactions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    item VARCHAR(20) NOT NULL CHECK (item <> ''),
    amount INTEGER NOT NULL CHECK (amount <> 0),
    date DATE NOT NULL
);
```

backend の「金額は 0 以外」（`backend/src/index.ts:85`）、OpenAPI の `minLength: 1`（`backend/openapi.yaml:104`）と同じルールを DB でも保証できます。

## 次に学ぶこと

- `INSERT` で行を入れる（→ 04 章）
- `ALTER TABLE` による列の追加・変更（カテゴリ列など）
- スキーマ定義をファイルで管理する（→ `../Database/04-migrations-and-schema-management.md`）
