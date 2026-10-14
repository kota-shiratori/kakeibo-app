# `postgres` イメージの環境変数（`POSTGRES_PASSWORD` は初回だけ効く）

## 概要

公式の `postgres` イメージは、起動時に **データディレクトリが空なら初期化（`initdb`）** を行い、そのときに環境変数を見てスーパーユーザーのパスワードや最初のデータベースを設定します。

逆に言うと、**すでにデータがあるボリュームで起動したときは、これらの環境変数は無視されます**。これを知らないと「パスワードを変えたのにログインできない」とハマります。

## このプロジェクトでの実装

```bash
docker run --name kakeibo-postgres -e POSTGRES_PASSWORD=mysecretpassword ... postgres:18.3
```

`POSTGRES_PASSWORD` だけを指定しているので、残りは既定値になります。

| 環境変数 | 既定値 | 今回の結果 |
| --- | --- | --- |
| `POSTGRES_PASSWORD` | なし（**必須**） | `postgres` ユーザーのパスワードになった |
| `POSTGRES_USER` | `postgres` | スーパーユーザー名は `postgres` |
| `POSTGRES_DB` | `POSTGRES_USER` と同じ | 最初に `postgres` という DB が作られた |

そのため学習メモでは、psql で `CREATE DATABASE kakeibo_db;` を手で実行して DB を作っています（→ `../SQL/03-create-database-and-table.md`）。`\l` の結果にも `postgres` と `kakeibo_db`（＋テンプレート用の `template0` / `template1`）が並んでいました。

## 重要語句

| 用語 | 意味 |
| --- | --- |
| **initdb** | PostgreSQL のデータディレクトリを新しく作る処理。テンプレート DB やスーパーユーザーもここで作られる |
| **スーパーユーザー** | すべての権限を持つ DB ユーザー。ここでは `postgres` |
| **エントリポイント（`docker-entrypoint.sh`）** | コンテナ起動時に最初に実行されるスクリプト。環境変数を見て初期化してから PostgreSQL を起動する |

## 実験：パスワードを指定しないと起動しない

```bash
docker run --name study-pg3 -d postgres:18.3
docker logs study-pg3
```

コンテナはすぐ終了し、ログの末尾付近にはこう出ていました（抜粋）。

```text
       You may also use "POSTGRES_HOST_AUTH_METHOD=trust" to allow all
       connections without a password. This is *not* recommended.
```

パスワードなしの DB を誤って公開しないよう、**パスワードの指定を必須にしている** わけです。`POSTGRES_HOST_AUTH_METHOD=trust` で回避できますが、エラーメッセージ自身が「推奨しない」と言っています。

## 実験：2 回目以降の起動では `POSTGRES_PASSWORD` が無視される

1. `POSTGRES_PASSWORD=first` でボリューム `study-pg-vol` を初期化
2. コンテナを削除し、同じボリュームで `POSTGRES_PASSWORD=second` にして起動し直す
3. Mac 側から `localhost:5433` に、それぞれのパスワードで接続してみる（node-postgres を使用）

```text
first OK
second NG: password authentication failed for user "postgres"
```

ログにも `Database directory appears to contain a database; Skipping initialization` と出ており、**初期化がスキップされたのでパスワードも `first` のまま** でした。

パスワードを変えたいときの方法：

- データを残したい → psql で `ALTER USER postgres WITH PASSWORD '新しいパスワード';`
- データが不要 → コンテナとボリュームを削除して作り直す（`docker rm -f ...` → `docker volume rm ...` → `docker run ...`）

## 仕様・注意点

- **`docker exec ... psql` にはパスワードが要らない**：これはコンテナ内からの接続が `trust`（パスワードなし）で許可されているためです。パスワードが正しいかどうかは、Mac 側から接続して初めて分かります（→ 07）。
- `POSTGRES_DB=kakeibo_db` を初回起動時に指定しておけば、`CREATE DATABASE` を手で実行する必要はありませんでした。これも **初回だけ** 効きます。
- 初回起動時に `/docker-entrypoint-initdb.d/` に置いた `.sql` / `.sh` ファイルを実行する機能もあります（テーブル作成を自動化できる）。これも **データディレクトリが空のときだけ** です。

## 今後に活かせるポイント

- 「コンテナの設定（環境変数）」と「ボリュームに保存された状態」は別物。**設定を変えても、状態は勝手には変わらない**。これは DB に限らず、Docker でステートフルなものを扱うときの基本的な考え方です。
- 接続の問題を調べるときは、コンテナ内の `psql` で成功したからといって安心せず、**アプリと同じ経路（Mac 側の `localhost:5432`）で試す**。

## 次に学ぶこと

- コンテナの起動・停止・削除とよくあるエラー（→ 06）
- `pg_hba.conf` による認証方式の切り替え（→ 07）
