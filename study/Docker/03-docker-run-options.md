# `docker run` のオプションを 1 つずつ読む

## 概要

`docker run` は「イメージからコンテナを **新しく作って** 起動する」コマンドです。学習メモのコマンドは、PostgreSQL をローカル開発用に動かすための典型的な形になっています。

## このプロジェクトでの実装

```bash
docker run --name kakeibo-postgres -e POSTGRES_PASSWORD=mysecretpassword -p 5432:5432 -v kakeibo-postgres-data:/var/lib/postgresql -d postgres:18.3
```

| 部分 | 意味 |
| --- | --- |
| `docker run` | コンテナを作成して起動する |
| `--name kakeibo-postgres` | コンテナに名前を付ける |
| `-e POSTGRES_PASSWORD=mysecretpassword` | コンテナに環境変数を渡す |
| `-p 5432:5432` | ポートを公開する（`ホスト側:コンテナ側`） |
| `-v kakeibo-postgres-data:/var/lib/postgresql` | ボリュームをマウントする（`ボリューム名:コンテナ内のパス`） |
| `-d` | バックグラウンドで実行する（detached） |
| `postgres:18.3` | 使うイメージ。**オプションはイメージ名より前に書く** |

実行後の状態（`docker ps`）：

```text
NAMES              IMAGE           STATUS        PORTS
kakeibo-postgres   postgres:18.3   Up 12 hours   0.0.0.0:5432->5432/tcp, [::]:5432->5432/tcp
```

## 各オプションの詳細

### `--name`

- 付けないとランダムな名前（`wizardly_turing` のような形）になります。
- 名前を付けておくと `docker exec kakeibo-postgres ...`、`docker stop kakeibo-postgres` のように名前で操作できます。
- **同じ名前のコンテナは 2 つ作れません**。2 回目の `docker run` はエラーになります（→ 06）。

### `-e`（`--env`）

- コンテナ内のプロセスに環境変数を渡します。`postgres` イメージは `POSTGRES_PASSWORD` などの環境変数を見て初期設定をします（→ 05）。
- `-e` は何個でも並べられます。

### `-p`（`--publish`）

```text
-p 5432:5432
   ↑    ↑
   ホスト（Mac）側のポート : コンテナ内のポート
```

- コンテナはそれぞれ独立したネットワークを持っているので、**`-p` を付けないと Mac 側の `localhost:5432` からは接続できません**。
- `docker ps` の `0.0.0.0:5432->5432/tcp` は「Mac のすべてのネットワークインターフェースの 5432 番を、コンテナの 5432 番につなぐ」という意味です。
- 左右の数字は違ってよいです。例えば Mac で別の PostgreSQL が 5432 を使っているなら `-p 5433:5432` とし、接続先を `localhost:5433` にします（コンテナ内の PostgreSQL は 5432 のまま）。
- `0.0.0.0` は同じネットワーク（Wi-Fi など）の他の端末からも接続できる状態を意味します。自分の Mac からだけ接続させたいなら `-p 127.0.0.1:5432:5432` と書けます。

### `-v`（`--volume`）

- `kakeibo-postgres-data` という名前の **ボリューム** を、コンテナ内の `/var/lib/postgresql` にマウントします。
- ボリュームが存在しなければ自動で作られます。
- これによりコンテナを削除してもデータが残ります。PostgreSQL 18 ではマウント先がそれ以前と変わっている点が重要です（→ 04）。

### `-d`（`--detach`）

- 付けないと、PostgreSQL のログがターミナルに流れ続け、そのターミナルを占有します（Ctrl+C で止まる）。
- `-d` を付けるとコンテナ ID だけを表示してすぐにプロンプトに戻ります。ログは `docker logs kakeibo-postgres` で後から見られます（→ 06）。

## 仕様・注意点

- **`docker run` は毎回「新しいコンテナ」を作る**：一度止めたコンテナをもう一度動かすときは `docker start kakeibo-postgres` を使います。`docker run` を再実行すると名前の衝突エラーになります（→ 06）。
- **再起動ポリシーは「なし」**：今回のコンテナは `--restart` を指定していないため、`docker inspect` で見ると RestartPolicy は `no` でした。Mac の再起動や Docker Desktop の再起動の後はコンテナが止まったままになるので、`docker start kakeibo-postgres` で起動します。自動で起動させたいなら `--restart unless-stopped` を付けて作成します。
- **パスワードがシェルの履歴に残る**：`-e POSTGRES_PASSWORD=...` はシェルの履歴（`~/.zsh_history`）にそのまま残ります。ローカル開発用の使い捨てパスワードなら実害は小さいですが、本番や共有の環境で使うパスワードをこの形で書くのは避けます。`--env-file` でファイルから読ませる方法もあります。

## 今後に活かせるポイント

- オプションが長くなってきたら、同じ内容を **Docker Compose** の `compose.yaml` に書くと、`docker compose up -d` だけで再現できてチームで共有しやすくなります。

```yaml
# compose.yaml（例・未作成）
services:
  db:
    image: postgres:18.3
    container_name: kakeibo-postgres
    environment:
      POSTGRES_PASSWORD: mysecretpassword
      POSTGRES_DB: kakeibo_db # 初回起動時に kakeibo_db を自動で作る（→ 05）
    ports:
      - "5432:5432"
    volumes:
      - kakeibo-postgres-data:/var/lib/postgresql
volumes:
  kakeibo-postgres-data:
    external: true # docker run で作った既存のボリュームをそのまま使う
```

※ `external: true` を付けないと、Compose はボリューム名の前にプロジェクト名を付けた **別のボリューム**（例：`kakeibo-app_kakeibo-postgres-data`）を新しく作るため、既存のデータは見えません。また、同じ名前のコンテナ `kakeibo-postgres` が残っていると衝突するので、移行するときは先に `docker rm` しておきます（ボリュームは消えません → 04）。

## 次に学ぶこと

- ボリュームと PostgreSQL 18 のデータディレクトリ（→ 04）
- `postgres` イメージが読む環境変数（→ 05）
