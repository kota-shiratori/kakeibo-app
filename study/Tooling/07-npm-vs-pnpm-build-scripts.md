# npm と pnpm（pnpm-workspace.yaml とビルドスクリプト許可）

## 概要

Node.js のパッケージマネージャには主に npm・pnpm・Yarn・Bun があります。

| | npm | pnpm |
| --- | --- | --- |
| 付属 | Node.js に標準同梱 | 別途インストール |
| lock ファイル | `package-lock.json` | `pnpm-lock.yaml` |
| node_modules | 依存をフラットに展開 | 全プロジェクト共通のストアからリンク。ディスク節約・高速 |
| 依存のインストールスクリプト | **デフォルトで実行する** | **v10 以降デフォルトで実行しない**（許可制） |
| 設定ファイル | `.npmrc` | `.npmrc` / `pnpm-workspace.yaml` |

このプロジェクトの backend は、**pnpm 用の設定ファイルがあるのに、実際は npm でインストールされている**という混在状態です。

## このプロジェクトでの実装

### pnpm-workspace.yaml

```yaml
# backend/pnpm-workspace.yaml:1-4
onlyBuiltDependencies:
  - esbuild
allowBuilds:
  esbuild: true
```

これは「**依存パッケージのうち、esbuild のインストールスクリプトだけは実行を許可する**」という pnpm の設定です。

#### なぜこの設定が必要なのか

- `esbuild` は Go 製のネイティブバイナリを使うツールで、インストール時にスクリプトを実行してプラットフォームに合ったバイナリを準備します（`backend/package-lock.json:871` に `"hasInstallScript": true`）。
- 依存パッケージのインストールスクリプトは、悪意あるパッケージが任意コードを実行する経路（サプライチェーン攻撃）になり得ます。そこで **pnpm v10 からは依存のビルドスクリプトをデフォルトで実行しない**ようになりました。
- `tsx` は内部で esbuild を使う（`backend/node_modules/tsx/package.json` の `dependencies` が `{"esbuild":"~0.28.0"}`）ため、esbuild を許可リストに入れています。

#### 2 つのキーが並んでいる理由

| キー | 状況 |
| --- | --- |
| `onlyBuiltDependencies` | pnpm v10 系の設定（許可するパッケージ名の配列）。pnpm 公式ドキュメント（https://pnpm.io/settings/build）によると **v11 で削除され `allowBuilds` に置き換え** |
| `allowBuilds` | pnpm **v10.26.0 で追加**された新しい設定。`パッケージ名: true/false` のマップで許可・不許可を明示する |

新旧どちらの pnpm でも動くよう、両方書かれていると考えられます（Hono のテンプレート `create-hono` が生成したファイルと思われます）。

参考: この環境にインストールされている pnpm は 10.17.0 で、その本体（`pnpm.cjs`）を検索すると `onlyBuiltDependencies` は含まれますが `allowBuilds` は含まれません。つまり**このマシンの pnpm では `allowBuilds` は無視され、`onlyBuiltDependencies` 側が効く**ことになります。

#### 「workspace」なのに 1 パッケージだけ？

`pnpm-workspace.yaml` は本来、複数パッケージを束ねるモノレポ用のファイル（`packages:` キーで対象を列挙する）です。しかし pnpm v10 以降はワークスペースを使わない単一プロジェクトでも、**pnpm の設定を書く場所**としてこのファイルが使われます。ここでは `packages:` がないので、ワークスペース機能は使っていません。

### 実際は npm でインストールされている

- `backend/package-lock.json` が存在し、`pnpm-lock.yaml` は存在しない。
- `backend/README.md:2-3` の手順も `npm install` / `npm run dev`。

**npm は `pnpm-workspace.yaml` を一切読みません。** npm はデフォルトで依存のインストールスクリプトを実行するので、esbuild の許可設定がなくても動いています。つまり現状この YAML は**実質的に何の効果もない**ファイルです。

### web-app は npm のみ

`web-app/package-lock.json` のみで、pnpm の痕跡はありません。

## 重要語句

- **パッケージマネージャ**: 依存の取得・インストール・lock 管理を行うツール。
- **インストールスクリプト（lifecycle scripts）**: `preinstall` / `install` / `postinstall` など、インストール時に自動実行されるスクリプト。
- **サプライチェーン攻撃**: 依存パッケージを乗っ取る・偽装するなどして、利用者の環境で悪意あるコードを実行させる攻撃。
- **モノレポ / ワークスペース**: 1 つのリポジトリで複数パッケージを管理する構成。

## 仕様・注意点

- **1 プロジェクトに lock ファイルは 1 種類**が原則。`package-lock.json` と `pnpm-lock.yaml` が両方あると、どちらが正しいか分からなくなり、人によって入るバージョンが変わる。
- pnpm で入れた `node_modules` を npm で操作する（またはその逆）と、構造が違うため壊れることがある。切り替えるときは `node_modules` と lock を削除してから入れ直す。
- pnpm 未許可のビルドスクリプトがあると、pnpm v10 は警告を出し（v11 では `strictDepBuilds` が既定で `true` のためインストールがエラー終了する）、`pnpm approve-builds` で対話的に許可できる。
- npm でも `npm install --ignore-scripts`（または `.npmrc` に `ignore-scripts=true`）で依存スクリプトを止められるが、そうすると esbuild などが動かなくなる場合がある。

## 今後に活かせるポイント

- テンプレート（`create-hono` など）が生成したファイルが、自分の選んだツールと合っているかを確認する癖をつける。
- 「依存のインストールスクリプトは危険になり得る」というセキュリティ観点は、どのパッケージマネージャを使う場合でも大事。

## 改善するなら

**パッケージマネージャを統一する**のが最優先です。2 案あります。

**案 A: npm に統一（いちばん簡単）**
1. `backend/pnpm-workspace.yaml` を削除する。
2. 両方の `package.json` に使うツールを明記する。
   ```json
   "packageManager": "npm@10.9.0"
   ```

**案 B: pnpm に統一（モノレポ化も視野に）**
1. リポジトリのルートに `pnpm-workspace.yaml` を作り、両方をワークスペースにする。
   ```yaml
   packages:
     - backend
     - web-app
   allowBuilds:
     esbuild: true
   ```
2. 各ディレクトリの `package-lock.json` と `node_modules` を削除し、ルートで `pnpm install` → `pnpm-lock.yaml` が 1 つだけできる。
3. ルートから `pnpm --filter backend dev` / `pnpm -r build` のようにまとめて操作できる。
4. web-app の lock を見ると、`hasInstallScript: true` なのは `fsevents`（macOS 用のファイル監視ライブラリ、`web-app/package-lock.json:2265-2270`）だけです。`lightningcss`・`oxlint`・`rolldown` などのネイティブバイナリは OS ごとの optionalDependencies として配布される方式なのでスクリプト不要です。`pnpm install` 時に未許可の警告が出たら、内容を確認したうえで `allowBuilds` に追加します。

## 次に学ぶこと

- Corepack と `packageManager` フィールド（プロジェクトごとにパッケージマネージャのバージョンを固定）
- pnpm workspace によるモノレポ運用（`--filter`, `-r`）
- Turborepo / Nx などのモノレポ用タスクランナー
