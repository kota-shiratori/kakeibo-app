# `docker pull` とイメージのタグ

## 概要

`docker pull` は、レジストリ（既定は Docker Hub）からイメージをダウンロードするコマンドです。`イメージ名:タグ` でどのバージョンを取得するかを指定します。

## このプロジェクトでの実装

```bash
docker pull postgres:18.3
```

実際の出力（2 回目の実行。すでに取得済みなので「最新」と表示される）：

```text
Digest: sha256:7e32e9833a6fb1c92c32552794cb6ed569d51b445a54907d35fc112ef39684db
Status: Image is up to date for postgres:18.3
docker.io/library/postgres:18.3
```

取得済みイメージの一覧：

```bash
docker images postgres
```

```text
IMAGE           ID             DISK USAGE   CONTENT SIZE   EXTRA
postgres:18.3   7e32e9833a6f        671MB          167MB   U
```

（Docker 29 の表示。`EXTRA` の `U` は「コンテナで使用中（In Use）」の意味）

## 重要語句

| 用語 | 意味 |
| --- | --- |
| `postgres` | イメージ名。正式には `docker.io/library/postgres`（Docker Hub の公式イメージは `library/` 配下） |
| `18.3` | タグ。PostgreSQL 18 系のマイナーバージョン 18.3 |
| Digest（`sha256:...`） | イメージの中身から計算したハッシュ。**中身が同じなら必ず同じ値** になる、本当の意味での識別子 |
| IMAGE ID | ローカルでのイメージの ID（今回の環境では Digest の先頭 12 文字 `7e32e9833a6f` と一致していた。Docker のバージョンや設定によっては一致しないこともある） |

### `docker.io/library/postgres:18.3` の読み方

```text
docker.io / library / postgres : 18.3
レジストリ   名前空間    リポジトリ  タグ
```

`docker pull postgres:18.3` と短く書けるのは、レジストリ `docker.io` と名前空間 `library` が省略時の既定値だからです。

## 仕様・注意点

### タグの選び方

`postgres` イメージには同じ中身を指す複数のタグがあります（例：`18.3` / `18` / `latest`）。

| 指定 | 意味 | 開発での扱い |
| --- | --- | --- |
| `postgres`（タグ省略） | `postgres:latest` と同じ | **避ける**。新しいメジャー版が出ると勝手に変わる |
| `postgres:18` | 18 系の最新マイナー版 | 18.4 が出ると中身が変わる |
| `postgres:18.3` | 18.3 に固定 | **今回の選択**。再現性が高い |

- PostgreSQL は **メジャーバージョン（17 → 18）が変わるとデータディレクトリの形式に互換性がありません**。`latest` のまま使っていると、ある日 pull し直しただけで既存のボリュームのデータを読めなくなる可能性があります。少なくともメジャーバージョンはタグで固定するのが安全です。
- **タグは書き換えられる**：同じ `18.3` でも、ベース OS のセキュリティ更新などでイメージが再ビルドされ、Digest が変わることがあります。完全に固定したい場合は `postgres@sha256:...` のように Digest で指定します。
- コンテナ内の環境変数で正確なバージョンを確認できます。今回のイメージは `PG_MAJOR=18`、`PG_VERSION=18.3-1.pgdg13+1`（Debian 13 ベースのパッケージ）でした（`docker image inspect postgres:18.3` で確認）。

### pull しなくても run できる

`docker run postgres:18.3` は、ローカルにイメージがなければ自動で pull します。明示的に `docker pull` するのは、「ダウンロードと起動を分けて、問題の切り分けをしやすくする」ためです。

### アーキテクチャ

公式イメージは複数の CPU アーキテクチャ向けに提供されていて、`docker pull` は実行している環境に合うものを自動で選びます。このPC（Apple Silicon）では `arm64` / `linux` のイメージが取得されていました。

## 今後に活かせるポイント

- 本番の DB とローカルの DB は **メジャーバージョンを揃える**。Neon 側で使っている PostgreSQL のバージョンも確認しておくと、「ローカルでは動くのに本番で動かない」を防げます（→ `../PostgreSQL/08-neon-and-vercel-attach-database-pool.md`）。
- 不要になったイメージは `docker rmi postgres:18.3`（使用中のコンテナがあると削除できない）や `docker image prune` で消せます。

## 次に学ぶこと

- `docker run` の各オプション（→ 03）
- Docker Hub の公式 `postgres` イメージのページ（対応タグ・環境変数の一覧が載っている）
