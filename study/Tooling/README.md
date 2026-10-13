# Tooling 学習ノート（開発ツール・ビルド・パッケージ管理）

家計簿アプリ（kakeibo-app）の `backend/`（Hono + tsx + TypeScript 7）と `web-app/`（React + Vite 8 + oxlint + TypeScript 6）のコードを題材に、開発ツールまわりで学べることをまとめたノートです。番号順に読むと理解しやすい構成になっています。

> tsconfig の各オプションの意味は study/TypeScript、CORS・環境変数の設計論は study/API-Design を参照してください。このフォルダではビルドフローやツールの仕組みに絞っています。

## 目次

### パッケージ管理の基礎

| # | ノート | 内容 |
| --- | --- | --- |
| 01 | [package.json の基本](./01-package-json-basics.md) | name / private / version / scripts など各フィールドの意味。backend の名前の末尾スペース問題 |
| 02 | ["type": "module" と ESM](./02-esm-type-module.md) | ESM と CommonJS の違い。backend の import に `.js` が付き、web-app では不要な理由 |
| 03 | [dependencies と devDependencies の違い](./03-dependencies-vs-devdependencies.md) | 実行時依存と開発時依存の分け方。フロントエンドではバンドルされる点、`@types/node` のバージョン不一致 |
| 04 | [セマンティックバージョニングと ^ / ~ の違い](./04-semver-caret-tilde.md) | SemVer の意味、`^` と `~` の範囲、TypeScript だけ `~6.0.2` になっている理由、`0.x` の特例 |
| 05 | [npm scripts](./05-npm-scripts.md) | dev / build / start / lint / preview がそれぞれ何をするか。`&&`、引数の渡し方、終了コード |
| 06 | [package-lock.json の役割](./06-package-lock-json.md) | lock ファイルの中身（version / resolved / integrity）、`npm install` と `npm ci` の違い |
| 07 | [npm と pnpm（pnpm-workspace.yaml とビルドスクリプト許可）](./07-npm-vs-pnpm-build-scripts.md) | `onlyBuiltDependencies` / `allowBuilds` で esbuild を許可する意味と、実際は npm で使われている混在状態 |

### backend の実行とビルド

| # | ノート | 内容 |
| --- | --- | --- |
| 08 | [tsx と tsx watch](./08-tsx-dev-runtime.md) | esbuild で TS を直接実行する仕組み、watch による再起動、型チェックをしない点 |
| 09 | [backend の本番フロー（tsc → node dist/index.js）](./09-backend-build-and-start.md) | tsc ビルドと本番起動、TypeScript 7（ネイティブ版）、`dist` が .gitignore になかった問題（2026-10-12 に修正済み） |

### Vite（web-app のビルドツール）

| # | ノート | 内容 |
| --- | --- | --- |
| 10 | [Vite の開発サーバ（ネイティブ ESM と HMR）](./10-vite-dev-server.md) | バンドルしない開発サーバ、事前バンドル、HMR、Vite 8 での Rolldown / Oxc への移行 |
| 11 | [index.html がエントリーポイント](./11-index-html-entry.md) | Vite が HTML から依存をたどる仕組み、ビルド時の書き換え、存在しない favicon |
| 12 | [vite build と型チェックの分離（tsc -b && vite build）](./12-vite-build-and-typecheck.md) | 変換と型チェックを分ける理由、Project References と `tsc -b`、`noEmit` |
| 13 | [vite preview と dist の中身](./13-vite-preview-and-dist.md) | dist の構造、ハッシュ付きファイル名とキャッシュ戦略、preview は本番サーバではない点 |
| 14 | [vite.config.ts と @vitejs/plugin-react](./14-vite-config-plugin-react.md) | `defineConfig`、Fast Refresh と automatic JSX runtime、plugin-react v6 の特徴 |
| 15 | [resolve.tsconfigPaths](./15-resolve-tsconfig-paths.md) | Vite 8 で tsconfig の `paths`（`@/`）をネイティブに解決する設定。node_modules で確認した仕様 |
| 16 | [import.meta.env と VITE_ 接頭辞のルール](./16-import-meta-env-vite-prefix.md) | ビルド時埋め込みと秘密を入れてはいけない理由、`types: ["vite/client"]`、型付けの方法 |

### Lint と運用

| # | ノート | 内容 |
| --- | --- | --- |
| 17 | [oxlint の基本](./17-oxlint-basics.md) | Rust 製 Linter と ESLint の違い、`.oxlintrc.json` の plugins（デフォルト上書きに注意）、カテゴリ、実行結果 |
| 18 | [oxlint の React ルールと Fast Refresh](./18-oxlint-react-rules-fast-refresh.md) | `rules-of-hooks` と `only-export-components`、`allowConstantExport` が Vite の Fast Refresh と関係する理由 |
| 19 | [.gitignore と .env をコミットしない運用](./19-gitignore-and-env-files.md) | 各 .gitignore の中身、`web-app/.env` が除外されていなかった問題（2026-10-12 に修正済み）、`.env.example` の推奨 |
| 20 | [開発時の起動手順](./20-local-dev-workflow.md) | backend と web-app を別ターミナルで起動する手順、設定値のつながり、よくあるトラブル |

## このフォルダで見つかった主な改善ポイント（まとめ）

| 優先度 | 内容 | 詳細 |
| --- | --- | --- |
| 済 | `web-app/.gitignore` に `.env` がない → 2026-10-12 に `.env` を追加済み | [19](./19-gitignore-and-env-files.md) |
| 済 | `backend/.gitignore` に `dist` がない → 2026-10-12 に `dist/` を追加済み | [09](./09-backend-build-and-start.md), [19](./19-gitignore-and-env-files.md) |
| 中 | backend で npm（package-lock.json）と pnpm（pnpm-workspace.yaml）が混在 | [07](./07-npm-vs-pnpm-build-scripts.md) |
| 中 | `.env.example` がない | [19](./19-gitignore-and-env-files.md) |
| 中 | typecheck スクリプトがない、backend に Linter がない | [05](./05-npm-scripts.md), [17](./17-oxlint-basics.md) |
| 低 | backend の `name` が `"backend "`（末尾スペース）、`private` なし | [01](./01-package-json-basics.md) |
| 低 | `@types/node` のバージョンが実行環境（Node 22）や両プロジェクト間で不一致 | [03](./03-dependencies-vs-devdependencies.md) |
| 低 | TypeScript のバージョン指定（`~` / `^`、6 / 7）が両プロジェクトで不統一 | [04](./04-semver-caret-tilde.md) |
| 低 | `index.html` の favicon が存在しない、`lang="en"` | [11](./11-index-html-entry.md) |

## 確認に使った環境（2026-10-12 時点）

- Node.js v22.12.0 / npm 10.9.0 / pnpm 10.17.0（グローバル）
- backend: hono 4.13.13, @hono/node-server 2.1.4, tsx 4.23.15（esbuild 0.28.2）, typescript 7.0.2
- web-app: vite 8.3.1（rolldown 1.2.11。vite の依存指定は `~1.2.9`）, @vitejs/plugin-react 6.1.1, oxlint 1.86.0, typescript 6.0.3, react 19.3.0
