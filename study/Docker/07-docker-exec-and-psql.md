# `docker exec` でコンテナ内の psql を使う

## 概要

`docker exec` は、**起動中のコンテナの中で** コマンドを実行します。`postgres` イメージには PostgreSQL 公式の CLI クライアント `psql` が入っているので、Mac に psql をインストールしなくても DB を操作できます（このPC には Mac 側の `psql` は入っていません）。

## このプロジェクトでの実装

```bash
docker exec -it kakeibo-postgres psql -U postgres
docker exec -it kakeibo-postgres psql -U postgres -d kakeibo_db
```

| 部分 | 意味 |
| --- | --- |
| `docker exec` | 起動中のコンテナでコマンドを実行する |
| `-i` | 標準入力を開いたままにする（キーボード入力を psql に渡す） |
| `-t` | 疑似端末（TTY）を割り当てる（プロンプト表示・矢印キーでの履歴・色などが使える） |
| `kakeibo-postgres` | 対象のコンテナ名 |
| `psql -U postgres` | コンテナ内で実行するコマンド。`-U` で接続するユーザーを指定 |
| `-d kakeibo_db` | 接続するデータベース。省略するとユーザー名と同じ名前の DB（`postgres`）に接続する |

1 つ目のコマンドで `postgres` DB に入り、`CREATE DATABASE kakeibo_db;` で家計簿用の DB を作成 → `\q` で抜けて、2 つ目のコマンドで `kakeibo_db` に入り直す、という流れです。psql の中で `\c kakeibo_db` と打っても切り替えられます（→ `../PostgreSQL/02-psql-meta-commands.md`）。

## なぜパスワードを聞かれないのか

コンテナ内の認証設定ファイル `pg_hba.conf` を確認しました。

```bash
docker exec kakeibo-postgres sh -c 'grep -v "^#" "$PGDATA/pg_hba.conf" | grep -v "^$"'
```

```text
local   all             all                                     trust
host    all             all             127.0.0.1/32            trust
host    all             all             ::1/128                 trust
local   replication     all                                     trust
host    replication     all             127.0.0.1/32            trust
host    replication     all             ::1/128                 trust
host all all all scram-sha-256
```

| 行 | 意味 |
| --- | --- |
| `local ... trust` | Unix ドメインソケット（同じマシン内のファイル経由の接続）は **パスワードなしで許可** |
| `host ... 127.0.0.1/32 trust` | コンテナ内の localhost からの TCP 接続も **パスワードなし** |
| `host all all all scram-sha-256` | それ以外（Mac 側からの接続を含む）は **パスワード必須**（SCRAM-SHA-256 方式） |

`docker exec` で起動した psql はコンテナの **中** で動くので、1 行目の `trust` に当たります。一方、Mac 上の backend は `-p 5432:5432` を経由してコンテナの **外** から接続するので、最後の行に当たり、パスワードが必要です。

上から順に評価され、最初に一致した行が使われます。

## 仕様・注意点

- **`-it` を付けないと対話できない**：`-i` がないと入力が渡らず、`-t` がないとプロンプトが出ません。逆に、スクリプトから SQL を流し込むときは `-t` を外します（`-t` があるとパイプやリダイレクトと相性が悪い）。

  ```bash
  # SQL を 1 文だけ実行
  docker exec kakeibo-postgres psql -U postgres -d kakeibo_db -c "SELECT COUNT(*) FROM transactions;"

  # ファイルから流し込む（-t を付けない）
  docker exec -i kakeibo-postgres psql -U postgres -d kakeibo_db < schema.sql
  ```

- **コンテナが止まっていると使えない**：`docker exec` は起動中のコンテナにしか使えません。`docker start` してから実行します（→ 06）。
- **`$PGDATA` はコンテナ内の環境変数**：上の `sh -c '...'` のようにシングルクォートで囲むと、Mac 側のシェルではなくコンテナ内のシェルで展開されます。
- psql の中で `exit` や `\q`、または Ctrl+D で抜けると、`docker exec` も終了します（コンテナ自体は動き続けます）。

## 今後に活かせるポイント

- 「DB に接続できない」ときは、①コンテナ内（`docker exec ... psql`）で入れるか、②Mac 側（アプリと同じ経路）から入れるか、を分けて確認すると、問題が DB 自体にあるのか、ポート・パスワードなど経路にあるのかを切り分けられます。
- Mac 側から GUI で DB を見たい場合は、TablePlus・DBeaver などのクライアントや VS Code の拡張機能から `localhost:5432` / ユーザー `postgres` / 設定したパスワードで接続できます。

## 次に学ぶこと

- psql のメタコマンド（`\l`・`\dt`・`\d` など）（→ `../PostgreSQL/02-psql-meta-commands.md`）
- backend から接続する（→ 08）
