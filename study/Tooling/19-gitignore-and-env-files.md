# .gitignore と .env をコミットしない運用

## 概要

`.gitignore` は「Git で管理しないファイル」を指定するファイルです。主に次のようなものを除外します。

| 種類 | 例 | 除外する理由 |
| --- | --- | --- |
| 依存パッケージ | `node_modules/` | `npm install` で再生成できる。巨大 |
| ビルド成果物 | `dist/` | `npm run build` で再生成できる |
| 環境変数ファイル | `.env` | **秘密情報や環境固有の値**が入る |
| ログ | `*.log` | 実行ごとに変わるゴミ |
| エディタ・OS の設定 | `.vscode/*`, `.idea`, `.DS_Store` | 個人の環境に依存 |

特に `.env` は、パスワードや API キーが入りうるため、**誤ってコミット・公開すると重大なセキュリティ事故**になります。代わりに、キー名だけを書いた **`.env.example`** をコミットして「どの変数が必要か」を共有するのが一般的です。

## このプロジェクトでの実装

リポジトリのルートには `.gitignore` がなく、`backend/` と `web-app/` にそれぞれあります（各テンプレートが生成したもの）。

### backend/.gitignore

```gitignore
# backend/.gitignore:11-19
# deps
node_modules/

# build
dist/

# env
.env
.env.production
```

- `backend/.gitignore:18` で `.env` を除外 → `backend/.env`（キー: `FRONTEND_URL`）はコミットされない。
- **（2026-10-12 に修正済み）** 以前は `dist` が含まれておらず、`npm run build` で作られる `backend/dist/` がコミット対象になってしまう状態でした。現在は `backend/.gitignore:14-15` に `dist/` が追加されています（[09](./09-backend-build-and-start.md)）。

### web-app/.gitignore

```gitignore
# web-app/.gitignore:10-16
node_modules
dist
dist-ssr
*.local

# env
.env
```

- `dist` は除外済み。
- `*.local` は `.env.local` や `.env.production.local` などを除外する（Vite の慣習では「`.local` 付き = 個人用・コミットしない」）。
- **（2026-10-12 に修正済み）** テンプレートの状態では `.env` が含まれていませんでした。現在は `web-app/.gitignore:15-16` に `# env` / `.env` が追加されています。

### 実際に確認した結果

`git check-ignore -v` で確認すると:

```
backend/.gitignore:18:.env     backend/.env      ← 無視される（OK）
backend/.gitignore:15:dist/    backend/dist/     ← 無視される（OK）
web-app/.gitignore:16:.env     web-app/.env      ← 無視される（OK）
web-app/.gitignore:11:dist     web-app/dist      ← 無視される（OK）
```

（2026-10-12 の修正前は、`web-app/.env` が**どのルールにもマッチせず Git の追跡対象**で、`git add web-app` するとコミットされてしまう状態でした。`.gitignore` を書いたら、このように `git check-ignore -v` で本当に効いているか確かめるのが確実です。）

`web-app/.env` に入っているのは `VITE_API_BASE_URL` で、これはそもそもビルド後の JS に埋め込まれる**公開値**なので、漏れても直ちに危険というわけではありません（[16](./16-import-meta-env-vite-prefix.md)）。ただし、

- 環境ごとに値が違うものをコミットすると、他の人の設定を上書きしてしまう
- 将来うっかり秘密を書いたときに漏れる

ため、**`.env` は一律でコミットしない**運用にするのが安全です。

なお Vite の慣習では、`.env`（共通のデフォルト値）はコミットし、`.env.local`（個人用・秘密）はコミットしない、という使い分けもあります。Vite テンプレートの `.gitignore` が当初 `*.local` だけを除外していたのはその考え方です（このプロジェクトは 2026-10-12 に `.env` も除外する方針に変更済み）。どちらの方針にするか**チームで決めて明文化する**ことが大切です。

## 重要語句

- **`.gitignore`**: Git の追跡対象から外すファイルのパターンを書くファイル。ディレクトリごとに置ける（そのディレクトリ以下に効く）。
- **`.env`**: 環境変数を `KEY=VALUE` 形式で書くファイル。
- **`.env.example`**: 必要な環境変数のキーと説明（値はダミー）を書いたテンプレート。コミットする。
- **`git check-ignore -v <path>`**: そのファイルがどの `.gitignore` のどの行で無視されているか調べるコマンド。
- **`!` パターン**: 除外の例外指定（`backend/.gitignore:3` の `!.yarn/releases` など）。

## 仕様・注意点

- **`.gitignore` は「まだ追跡していないファイル」にしか効きません。** 一度コミットしてしまったファイルは、後から `.gitignore` に書いても追跡され続けます。外すには `git rm --cached <file>` が必要です。
- **一度でも秘密をコミット・push したら、履歴に残ります。** ファイルを消すだけでは不十分で、**その秘密を無効化（キーの再発行・パスワード変更）**するのが第一の対応です。
- 現在このリポジトリは**まだ一度もコミットされていません**（`git status` で `backend/` と `web-app/` が `??` = 未追跡）。最初のコミット前の今が、`.gitignore` を整える絶好のタイミングです。
- `backend/.gitignore` の `.yarn/` 関連（`:2-3`）は Yarn 用の設定で、このプロジェクトでは使っていません（テンプレート由来）。
- `.DS_Store`（macOS）は両方で除外済み。

## 今後に活かせるポイント

- **最初のコミットの前に** `git status` と `git add -n .`（ドライラン）で、何がコミットされるか必ず確認する。
- 新しく環境変数を追加したら、同時に `.env.example` も更新する習慣をつける。
- GitHub の Secret Scanning や `gitleaks` などのツールで、秘密の混入を自動検出できる。

## 改善するなら

1. **`web-app/.gitignore` に `.env` を追加する**（方針を「`.env` はコミットしない」に統一する場合。**2026-10-12 に `.env` の 1 行は追加済み**。`.env.*` と `!.env.example` まで書くと、モード別ファイルも含めて一律に除外できる）。
   ```gitignore
   # env
   .env
   .env.*
   !.env.example
   ```
2. **`backend/.gitignore` に `dist` を追加する**（**2026-10-12 に対応済み**）。
   ```gitignore
   # build
   dist/
   ```
3. **`.env.example` を両方に用意する**（値はダミーか、ローカル開発用の安全なデフォルト）。
   ```sh
   # backend/.env.example
   # フロントエンドのオリジン（CORS の許可先）
   FRONTEND_URL=http://localhost:5173
   ```
   ```sh
   # web-app/.env.example
   # backend API のベース URL（ビルド時に JS へ埋め込まれる公開値。秘密は書かないこと）
   VITE_API_BASE_URL=http://localhost:3000
   ```
   新しく参加した人は `cp .env.example .env` するだけで始められる。README にその手順を書く（[20](./20-local-dev-workflow.md)）。
4. ルートに共通の `.gitignore` を置き、`.DS_Store` やエディタ設定など全体共通のものをまとめるのも一案。

## 次に学ぶこと

- `gitleaks` / GitHub Secret Scanning による秘密情報の検出
- dotenvx・1Password CLI・Doppler などのシークレット管理
- Husky の pre-commit で `.env` のコミットをブロックする
