# ボリュームでデータを残す / PostgreSQL 18 のマウント先の変更

## 概要

コンテナの中で書き換えたファイルは、**コンテナを削除すると一緒に消えます**。DB のデータが消えては困るので、データの置き場所を **ボリューム**（コンテナの外で Docker が管理する保存領域）にします。

また、`postgres` イメージは **18 からデータの置き場所（とマウントすべき場所）が変わりました**。古い記事のとおり `/var/lib/postgresql/data` にマウントすると、PostgreSQL 18 ではコンテナが起動しません。学習メモの `-v kakeibo-postgres-data:/var/lib/postgresql` は 18 向けの正しい書き方です。

## このプロジェクトでの実装

```bash
-v kakeibo-postgres-data:/var/lib/postgresql
```

確認した内容：

```bash
docker volume inspect kakeibo-postgres-data --format '{{.Name}} {{.Driver}} {{.Mountpoint}}'
# kakeibo-postgres-data local /var/lib/docker/volumes/kakeibo-postgres-data/_data

docker image inspect postgres:18.3 --format '{{json .Config.Volumes}}'
# {"/var/lib/postgresql":{}}

docker image inspect postgres:18.3   # Env の中に
# PGDATA=/var/lib/postgresql/18/docker
```

| 場所 | 中身 |
| --- | --- |
| `/var/lib/postgresql` | ボリュームのマウント先（イメージが `VOLUME` として宣言している場所） |
| `/var/lib/postgresql/18/docker` | 実際のデータディレクトリ（`PGDATA`）。`base/`、`global/`、`pg_hba.conf` などが入っている |

コンテナ内で `ls /var/lib/postgresql` を実行すると `18` だけが見えます（実験で確認）。

## 重要語句

| 用語 | 意味 |
| --- | --- |
| **名前付きボリューム（named volume）** | `kakeibo-postgres-data` のように名前を付けたボリューム。`docker volume ls` で一覧できる |
| **バインドマウント** | `-v ./pgdata:/var/lib/postgresql` のように **Mac 上のフォルダ** をマウントする方法。名前の代わりにパスを書く |
| **匿名ボリューム** | `-v` を付けずに起動したとき、イメージの `VOLUME` 宣言に従って自動で作られる、名前がランダム（長い16進数）のボリューム |
| **`PGDATA`** | PostgreSQL がデータファイルを置くディレクトリを示す環境変数 |

## 実験：コンテナを削除してもデータは残るか

使い捨てのコンテナ（`study-pg`、ポート 5433）で確認しました。

```bash
docker run --name study-pg -e POSTGRES_PASSWORD=first -p 5433:5432 -v study-pg-vol:/var/lib/postgresql -d postgres:18.3
docker exec study-pg psql -U postgres -c "CREATE TABLE t(x int); INSERT INTO t VALUES (42);"
docker rm -f study-pg                       # コンテナを削除

docker run --name study-pg -e POSTGRES_PASSWORD=second -p 5433:5432 -v study-pg-vol:/var/lib/postgresql -d postgres:18.3
docker exec study-pg psql -U postgres -c "SELECT * FROM t;"
```

```text
 x
----
 42
(1 row)
```

**同じボリュームをマウントすれば、新しいコンテナでもデータはそのまま** でした。ログには `PostgreSQL Database directory appears to contain a database; Skipping initialization` と出ていて、初期化がスキップされたことが分かります（このとき `POSTGRES_PASSWORD=second` が無視される点は → 05）。

## 実験：PostgreSQL 18 で古いマウント先を使うとどうなるか

```bash
docker run --name study-pg-olddata -e POSTGRES_PASSWORD=a -v study-pg-olddata:/var/lib/postgresql/data postgres:18.3
```

コンテナはすぐに `Exited (1)` になり、ログには次のエラーが出ました（抜粋）。

```text
Error: in 18+, these Docker images are configured to store database data in a
       format which is compatible with "pg_ctlcluster" (specifically, using
       major-version-specific directory names).  This better reflects how
       PostgreSQL itself works, and how upgrades are to be performed.

       See also https://github.com/docker-library/postgres/pull/1259

       Counter to that, there appears to be PostgreSQL data in:
...
       The suggested container configuration for 18+ is to place a single mount
       at /var/lib/postgresql which will then place PostgreSQL data in a
       subdirectory, allowing usage of "pg_upgrade --link" without mount point
       boundary issues.
```

要点：

- 17 以前のイメージ：`PGDATA=/var/lib/postgresql/data` で、そこにマウントするのが定番だった。
- 18 以降のイメージ：`PGDATA=/var/lib/postgresql/18/docker` のように **メジャーバージョンごとのサブディレクトリ** に置く。マウントは親の `/var/lib/postgresql` に 1 つだけ。
- 目的：将来 19 に上げるとき、`/var/lib/postgresql/18/...` と `/var/lib/postgresql/19/...` を同じボリューム内に並べて `pg_upgrade --link`（コピーせずにハードリンクで移行する高速なアップグレード）を使えるようにするため。

ネット上の記事や生成 AI の回答は 17 以前の書き方（`/var/lib/postgresql/data`）が多いので、**18 以降を使うときは特に注意** が必要です。

## 仕様・注意点

- **ボリュームの実体は Mac のファイルシステムには直接見えない**：`Mountpoint` は `/var/lib/docker/volumes/...` ですが、これは Docker Desktop の Linux VM 内のパスです。Finder で開くことはできません。
- **ボリュームは明示的に消さない限り残る**：`docker rm` ではボリュームは消えません。消すには `docker volume rm kakeibo-postgres-data`（使用中のコンテナがあると失敗する）。データを完全に作り直したいときに使います。
- **`docker volume ls` に見覚えのない長い名前がある**：このPC にも `6efba482...` という名前のボリュームがありました。`-v` を付け忘れて `postgres` などを起動すると匿名ボリュームが作られるので、それが残っている可能性があります。不要なら `docker volume prune`（どのコンテナからも使われていないボリュームを削除）で整理できますが、**他のプロジェクトのデータも消える可能性がある** ので中身を確認してから実行します。
- **メジャーバージョンの変更はボリュームを差し替えるだけでは済まない**：18 のボリュームを 19 のイメージで使う場合、データ形式の移行（`pg_upgrade` か、`pg_dump` → リストア）が必要です。

## 今後に活かせるポイント

- 開発用の DB は「消えても作り直せる」状態にしておくと気が楽です。テーブル定義を SQL ファイルとしてリポジトリに置いておけば、ボリュームを消しても再現できます（→ `../Database/04-migrations-and-schema-management.md`）。
- バックアップは `docker exec kakeibo-postgres pg_dump -U postgres kakeibo_db > backup.sql` のように `pg_dump` で取れます。

## 次に学ぶこと

- `postgres` イメージの環境変数と「初回だけ初期化される」仕組み（→ 05）
- `pg_dump` / `pg_restore` によるバックアップとリストア
