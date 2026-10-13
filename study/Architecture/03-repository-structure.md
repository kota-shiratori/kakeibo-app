# リポジトリとディレクトリ構成 — 独立した 2 パッケージ

## 概要

kakeibo-app は 1 つの Git リポジトリの中に `backend/` と `web-app/` という **2 つの独立した npm パッケージ** を並べた構成です。ルートに `package.json` はなく、いわゆる **モノレポ（workspace 機能でパッケージを束ねる構成）ではありません**。

「どこに何を置くか」はチーム全員の地図になるため、構成とその理由・限界を理解しておくことは重要です。

## このプロジェクトでの実装

```text
kakeibo-app/                 ← Git リポジトリのルート（package.json なし）
├── backend/                 ← API サーバー（独立した npm パッケージ）
│   ├── src/
│   │   ├── index.ts         ← サーバー本体（全ルートがここ）
│   │   └── env.ts           ← 環境変数の検証
│   ├── openapi.yaml         ← API 仕様書
│   ├── package.json / package-lock.json
│   ├── pnpm-workspace.yaml  ← pnpm 用設定（esbuild のビルド許可のみ）
│   ├── tsconfig.json
│   └── .env                 ← FRONTEND_URL（.gitignore 済み）
├── web-app/                 ← フロントエンド（独立した npm パッケージ）
│   ├── index.html
│   ├── src/
│   │   ├── main.tsx         ← エントリーポイント
│   │   ├── App.tsx          ← ルーティング
│   │   ├── pages/           ← 画面（Home, Input）
│   │   ├── components/      ← 表示部品（Header, TransactionList）
│   │   └── hooks/           ← データ取得フック + 型定義
│   ├── vite.config.ts / tsconfig*.json / .oxlintrc.json
│   ├── vercel.json          ← Vercel のビルド・配信設定（study も /study/ として同梱）
│   ├── package.json / package-lock.json
│   └── .env                 ← VITE_API_BASE_URL（.gitignore 済み）
└── study/                   ← 学習ノート（VitePress 用の package.json / .vitepress/ を持つ）
```

それぞれの `package.json` が別々の依存関係とスクリプトを持ちます。

```json
// backend/package.json:4-8
"scripts": {
  "dev": "tsx watch src/index.ts",
  "build": "tsc",
  "start": "node dist/index.js"
}
```

```json
// web-app/package.json:6-12
"scripts": {
  "dev": "vite",
  "build": "tsc -b && vite build",
  "build:study": "npm --prefix ../study ci && STUDY_BASE=/study/ npm --prefix ../study run docs:build && rm -rf dist/study && cp -R ../study/.vitepress/dist dist/study",
  "lint": "oxlint",
  "preview": "vite preview"
}
```

開発時はターミナルを 2 つ開き、それぞれのディレクトリで `npm run dev` を実行します。

TypeScript のバージョンも別々です（`backend/package.json:19` は `^7.0.2`、`web-app/package.json:27` は `~6.0.2`）。独立パッケージなので、こうした違いが許容されます。

## 重要語句

- **パッケージ**: `package.json` を持つ単位。依存関係とスクリプトの境界。
- **モノレポ（monorepo）**: 複数パッケージを 1 リポジトリで管理し、workspace 機能（npm/pnpm/yarn workspaces）で依存関係やコード共有を束ねる構成。
- **ポリレポ（polyrepo）**: パッケージごとにリポジトリを分ける構成。
- **lock ファイル**: `package-lock.json` など、実際にインストールされたバージョンを固定するファイル。

## 仕様・注意点

- **型やコードの共有手段がない**: `web-app/src/hooks/transactions.ts` の `Transaction` 型と、バックエンドが返す JSON の形は、人間が手で揃えています（`14-api-contract-and-types.md`）。
- **パッケージマネージャーの混在**: `backend/` には npm の `package-lock.json` と pnpm 用の `pnpm-workspace.yaml` が同居しています。`pnpm-workspace.yaml` の中身は esbuild のビルドスクリプト許可（`onlyBuiltDependencies` / `allowBuilds`）だけで、workspace としては使われていません。どちらか一方に統一したほうが混乱がありません。
- `backend/package.json:2` の `"name": "backend "` は末尾に空白が入っています（npm に公開しないので実害は小さいですが、修正しておくのが無難）。
- **`.env` の Git 管理**: 当初は `backend/.gitignore` だけが `.env` を除外し、`web-app/.gitignore` には `.env` の行がありませんでした（`*.local` のみ）。2026-10-12 に修正済みで、現在は `backend/.gitignore:18` と `web-app/.gitignore:16` の両方で `.env` を除外しています（同日に `backend/.gitignore:15` へ `dist/` も追加）。`VITE_` 付きの変数はどのみちブラウザに配信される公開値ですが、「環境ごとの値をコミットするか」は方針として決めておくべきです（`13-configuration-externalization.md`）。
- リポジトリ全体を対象にした共通の lint / format / CI 設定もまだありません。

## 今後に活かせるポイント

- 小規模・学習用なら「フォルダを並べるだけ」の構成は単純で理解しやすい。各パッケージが独立しているので、片方だけ別リポジトリに切り出すのも容易。
- 構成を選ぶ基準: **コード共有の必要性**（型・バリデーションを共有したいならモノレポ）、**デプロイの単位**、**チームの分かれ方**。

## 改善するなら

型共有が必要になった段階で、pnpm workspace によるモノレポ化が選択肢になります。

```text
kakeibo-app/
├── package.json            ← ルート（"private": true、共通スクリプト）
├── pnpm-workspace.yaml     ← packages: ["apps/*", "packages/*"]
├── apps/
│   ├── backend/
│   └── web-app/
└── packages/
    └── shared/             ← 型・Zod スキーマなど両方で使うもの
        └── src/transaction.ts
```

```yaml
# pnpm-workspace.yaml（ルート、案）
packages:
  - "apps/*"
  - "packages/*"
```

```json
// apps/web-app/package.json（案）
"dependencies": { "@kakeibo/shared": "workspace:*" }
```

モノレポ化しない場合でも、最低限「パッケージマネージャーを 1 つに統一」「ルートに README で起動手順を書く」だけで扱いやすくなります。

## 次に学ぶこと

- **pnpm workspace / npm workspaces** の仕組みと `workspace:*` プロトコル。
- **Turborepo / Nx**: モノレポでのタスク実行・キャッシュの最適化ツール。
