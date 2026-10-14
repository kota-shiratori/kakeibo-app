# psql のメタコマンド

## 概要

`psql` は PostgreSQL 付属のコマンドラインクライアントです。SQL 文に加えて、`\`（バックスラッシュ）で始まる **メタコマンド** で DB やテーブルの一覧・構造を確認できます。メタコマンドは psql 自身の機能で、SQL ではありません（他のクライアントや `pg` からは使えない）。

## このプロジェクトでの実装

コンテナの中の psql を使っています（psql 自体はホストの Mac には入っていない。`which psql` で見つからないことを確認）。

```bash
# postgres DB に接続
docker exec -it kakeibo-postgres psql -U postgres
# kakeibo_db に直接接続
docker exec -it kakeibo-postgres psql -U postgres -d kakeibo_db
```

`docker exec` のオプションは `../Docker/07-docker-exec-and-psql.md` を参照。

### `\dt` — テーブル一覧（学習メモより）

```text
kakeibo_db=# \dt
              List of tables
 Schema |     Name     | Type  |  Owner
--------+--------------+-------+----------
 public | transactions | table | postgres
(1 row)
```

### `\d transactions` — テーブル構造（学習メモより）

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

読み方:

- `Type`: `VARCHAR(20)` は正式名 `character varying(20)` で表示される（→ 03 章）
- `Nullable`: `not null` は NOT NULL 制約あり（→ 05 章）
- `Default`: IDENTITY 列であること（→ 04 章）
- `Indexes`: 主キーを付けると `テーブル名_pkey` という名前の B-tree インデックスが自動で作られる（`../Database/02-keys-and-indexes.md`）

## 重要語句

| コマンド | 意味 |
| --- | --- |
| `\l` | データベース一覧（list） |
| `\c 名前` | 別のデータベースに接続し直す（connect） |
| `\dt` | 現在の DB のテーブル一覧（describe tables） |
| `\d 名前` | テーブルなどの構造を表示（describe） |
| `\d` | テーブル・ビュー・シーケンスの一覧 |
| `\du` | ロール（ユーザー）一覧 |
| `\x` | 縦長表示（expanded）の切り替え。列が多いときに見やすい |
| `\i ファイル` | SQL ファイルを読み込んで実行 |
| `\?` | メタコマンドのヘルプ |
| `\h SQL名` | SQL 文のヘルプ（例: `\h CREATE TABLE`） |
| `\q` | psql を終了（quit） |

## 仕様・注意点

- **プロンプトの意味**:
  - `kakeibo_db=#` … 接続中の DB 名。`#` はスーパーユーザー（一般ユーザーなら `>`）
  - `kakeibo_db-#` … **前の行の SQL がまだ終わっていない**（`;` 待ち）。複数行の SQL を書いている途中の状態
  - `kakeibo_db(#` / `kakeibo_db'#` … 括弧やクォートが閉じていない
- **SQL は `;` で終わるまで実行されない**。一方メタコマンドは `;` 不要で、改行で即実行される。
- 入力途中の SQL を捨てたいときは `\r`（リセット）か Ctrl+C。
- 結果が長いとページャ（`less`）が開くことがあります。`q` で抜けられます。
- メタコマンドの出力は psql が裏で SQL（システムカタログの検索）を発行して作っています。`psql -E` で起動すると、その SQL が表示されます。

## 今後に活かせるポイント

- 「テーブルを作ったら `\d テーブル名` で確認する」を習慣にすると、型・NOT NULL・既定値の付け忘れにすぐ気づける。
- 本番（Neon）にも psql で接続できる。接続文字列を引数に渡す: `psql "postgresql://..."`（Neon 側の接続文字列の形式は Neon のダッシュボードで確認）。

## 次に学ぶこと

- 各列の型の意味（→ 03 章）
- SQL の文法（`../SQL/02-sql-syntax-basics.md`）
