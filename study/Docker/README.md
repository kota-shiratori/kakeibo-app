# Docker 学習ノート

家計簿アプリ（kakeibo-app）の **ローカル開発用 PostgreSQL を Docker で動かす** ときに学んだことをまとめたノートです。学習メモ（`./01`）で実行したコマンドを 1 つずつ読み解いています。

- 対象バージョン（このPC で確認）: Docker 29.1.3 / イメージ `postgres:18.3`（`PG_VERSION=18.3-1.pgdg13+1`、arm64 / linux）
- 記載している挙動の多くは、普段使っている `kakeibo-postgres` を **変更せず**、使い捨てのコンテナ（`study-pg` など、ポート 5433）とボリュームを作って実験し、確認後に削除しています。
- PostgreSQL そのもの（psql・データ型・node-postgres）は `../PostgreSQL/`、SQL 文法は `../SQL/`、テーブル設計は `../Database/` を参照してください。

## 目次（学習順）

| # | ノート | 内容 |
| --- | --- | --- |
| 01 | [Docker とは何か](./01-what-is-docker.md) | イメージ・コンテナ・レジストリ・ボリューム、なぜ DB を Docker で動かすのか |
| 02 | [`docker pull` とイメージのタグ](./02-docker-pull-and-image-tags.md) | `postgres:18.3` の読み方、`latest` を避ける理由、Digest |
| 03 | [`docker run` のオプション](./03-docker-run-options.md) | `--name` / `-e` / `-p` / `-v` / `-d` の意味、再起動ポリシー、Compose での書き方 |
| 04 | [ボリュームと PostgreSQL 18 のマウント先](./04-volumes-and-pg18-data-directory.md) | コンテナを消してもデータが残る仕組み、18 で `/var/lib/postgresql/data` が使えなくなった理由 |
| 05 | [`postgres` イメージの環境変数](./05-postgres-image-env-vars.md) | `POSTGRES_PASSWORD` は必須かつ **初回だけ** 効く、`POSTGRES_DB` |
| 06 | [コンテナのライフサイクルとエラー](./06-container-lifecycle-and-troubleshooting.md) | `ps` / `start` / `stop` / `rm` / `logs`、名前の衝突・ポートの衝突 |
| 07 | [`docker exec` と psql](./07-docker-exec-and-psql.md) | `-it` の意味、コンテナ内からはパスワード不要な理由（`pg_hba.conf`） |
| 08 | [backend からローカル DB に接続する](./08-connecting-backend-to-local-db.md) | `DATABASE_URL` の組み立て方、よくある接続エラー |

## このノートで見つかった主な改善ポイント（まとめ）

1. `backend/.env` に `DATABASE_URL` がなく、ローカルで backend を読み込むと `env.ts` の検証で止まる → `postgresql://postgres:<password>@localhost:5432/kakeibo_db` を追加する（08 章）
2. コンテナの再起動ポリシーが `no` で、Mac・Docker Desktop を再起動すると DB が止まったまま → `docker start` を習慣にするか、`--restart unless-stopped`（03, 06 章）
3. `docker run` の長いコマンドが手元のメモにしかない → `compose.yaml` にしてリポジトリで共有する（03 章）
4. DB 名・テーブルを手で作っている → `POSTGRES_DB` や `/docker-entrypoint-initdb.d/` + `schema.sql` で自動化できる（05 章、`../Database/04-migrations-and-schema-management.md`）
5. `-p 5432:5432` は同じネットワークの他の端末からも接続できる → 自分の Mac だけでよいなら `-p 127.0.0.1:5432:5432`（03 章）

## 注意：PostgreSQL 18 以降のマウント先

ネット上の多くの記事は `-v ...:/var/lib/postgresql/data` と書いていますが、**`postgres:18` 以降のイメージでは `-v ...:/var/lib/postgresql` が正解** です。古い書き方で起動するとコンテナがエラーで止まることを実験で確認しました（04 章）。
