# テーブル定義をコードで管理する（スキーマ管理とマイグレーション）

## 概要

学習メモでは、`transactions` テーブルを **psql に `CREATE TABLE` を手で打って** 作りました。学習としては正しい手順ですが、この方法には次の問題があります。

- テーブル定義が **リポジトリのどこにも残っていない**（DB の中にしかない）
- ローカル（Docker）と本番（Neon）の **両方に同じ操作を手でする** 必要があり、ずれやすい
- Docker のボリュームを消したら、どう作ったかを思い出す必要がある
- 列を追加するなどの **変更の履歴** が残らない

そこで、テーブル定義を **ファイルとしてリポジトリで管理し、コマンドで適用する** のが一般的です。変更の 1 つ 1 つをファイルにして順番に適用する仕組みを **マイグレーション** と呼びます。

## このプロジェクトでの現状

- リポジトリ内に `.sql` ファイルやマイグレーション用のフォルダは **ありません**（`git ls-files backend` で確認）。
- テーブル定義が分かるのは、`study/SQL/01`（学習メモ）と、DB の中（`\d transactions`）だけ。
- backend のコードは `transactions` テーブルと `id` / `item` / `amount` / `date` 列が **存在する前提** で SQL を書いている（`backend/src/index.ts:41`、`94`）。

ローカルで動いていても、Neon 側にテーブルがない・列名が違うと、本番で `relation "transactions" does not exist` などのエラーになります。

## ステップ 1：スキーマを SQL ファイルとして保存する

まずは手で打った SQL をそのままファイルにします。

```sql
-- backend/db/schema.sql（案）
CREATE TABLE IF NOT EXISTS transactions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    item VARCHAR(20) NOT NULL,
    amount INTEGER NOT NULL,
    date DATE NOT NULL
);
```

適用方法：

```bash
# ローカル（Docker）：ファイルを標準入力から流し込む（-t は付けない）
docker exec -i kakeibo-postgres psql -U postgres -d kakeibo_db < backend/db/schema.sql
```

本番（Neon）には、Neon のダッシュボードの SQL エディタに同じ内容を貼り付けるか、Mac に psql を入れて Neon の接続文字列で実行します。

- `IF NOT EXISTS` を付けると、すでにテーブルがあってもエラーにならず、何度実行しても同じ結果になります（冪等）。
- ただし **`IF NOT EXISTS` は「テーブルがあれば何もしない」だけ** で、既存のテーブルに列を足してはくれません。変更が発生したら次のステップが必要です。

## ステップ 2：変更をマイグレーションとして積み重ねる

テーブル定義の変更を、番号（または日時）付きのファイルにして順番に適用します。

```text
backend/migrations/
├── 0001_create_transactions.sql
├── 0002_add_amount_check.sql        ← ALTER TABLE ... ADD CONSTRAINT（Database/03 の改善案）
└── 0003_add_created_at.sql          ← ALTER TABLE ... ADD COLUMN created_at ...
```

マイグレーションツールは、**どのファイルまで適用済みか** を DB 内の管理用テーブルに記録し、未適用のものだけを実行します。これにより、

- ローカルでも本番でも「同じコマンド」で同じ状態にできる
- 新しく開発に参加した人も、空の DB から最新の状態を作れる
- 変更の履歴が Git に残り、コードの変更と一緒にレビューできる

## 主な選択肢

| ツール | 特徴 |
| --- | --- |
| 素の SQL ファイル + 手順書 | 一番シンプル。小規模ならこれで十分なことも多い |
| node-pg-migrate | `pg` を使う Node.js 向けのマイグレーションツール。SQL または JS で書く |
| Drizzle ORM（drizzle-kit） | TypeScript でテーブル定義を書き、差分から SQL を生成する。クエリにも型が付く |
| Prisma | 独自のスキーマファイルからマイグレーションとクライアントを生成する |

今のプロジェクトは `pg` で SQL を直接書いているので、学習の流れとしては「SQL ファイル → node-pg-migrate などの SQL ベースのツール → 必要なら ORM」と進むのが理解しやすいと思います。ORM を入れると、`../PostgreSQL/07-node-postgres-type-conversion.md` で扱った型変換の問題（`id` が文字列で返る、など）も型定義と一緒に扱えるようになります。

## 仕様・注意点

- **本番 DB へのマイグレーションは慎重に**：列の削除や型の変更は、データを失ったりアプリが一時的に動かなくなったりする可能性があります。適用前に `pg_dump` でバックアップを取る、Neon ならブランチ機能でテストする（未確認・Neon の公式ドキュメントで要確認）などの備えをします。
- **コードとスキーマの適用順**：新しい列を使うコードをデプロイする **前に**、その列を追加するマイグレーションを適用しておく必要があります。逆にすると、デプロイ直後にエラーになります。
- **一度適用したマイグレーションファイルは書き換えない**：すでに適用済みの環境には反映されないため。修正は新しいマイグレーションとして追加します。

## 今後に活かせるポイント

- 「DB の状態」もコードと同じく **リポジトリで管理し、再現可能にする**。これは環境変数を `env.ts` で検証するのと同じく、「手作業と暗黙の前提を減らす」考え方です。
- Docker の `postgres` イメージは、初回起動時に `/docker-entrypoint-initdb.d/` の SQL を実行できるので、`schema.sql` をそこにマウントすれば「ボリュームを消して起動し直すだけで、テーブルまで揃った DB ができる」状態にできます（→ `../Docker/05-postgres-image-env-vars.md`）。

## 次に学ぶこと

- テスト用の DB を用意し、テストのたびにスキーマを適用して空の状態から始める（`../Architecture/16-testing-strategy.md`）
- シードデータ（開発用の初期データ）をファイルで管理する
