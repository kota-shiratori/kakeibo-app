# npm scripts（dev / build / start / lint / preview）

## 概要

`package.json` の `scripts` に登録したコマンドは `npm run <名前>` で実行できます。

- `npm run` 実行中は `node_modules/.bin` が **PATH に追加**されるため、`vite` や `tsx` のようにローカルにインストールしたコマンドをグローバルインストールなしで使えます。
- `start` と `test` は特別扱いで、`npm start` / `npm test` と `run` を省略できます（`dev`・`build` などは `npm run dev` のように `run` が必要）。

## このプロジェクトでの実装

### backend

```json
// backend/package.json:4-8
"scripts": {
  "dev": "tsx watch src/index.ts",
  "build": "tsc",
  "start": "node dist/index.js"
},
```

| コマンド | 実行内容 | いつ使う |
| --- | --- | --- |
| `npm run dev` | `tsx` で `src/index.ts` を直接実行し、ファイル変更で自動再起動 | 開発中 |
| `npm run build` | `tsc` で `src/*.ts` → `dist/*.js` に変換（型チェックも行う） | 本番用の成果物を作るとき |
| `npm start` | ビルド済みの `dist/index.js` を素の Node.js で実行 | 本番環境 |

詳細は [08-tsx-dev-runtime.md](./08-tsx-dev-runtime.md) と [09-backend-build-and-start.md](./09-backend-build-and-start.md)。

### web-app

```json
// web-app/package.json:6-12（9 行目の build:study は省略）
"scripts": {
  "dev": "vite",
  "build": "tsc -b && vite build",
  "lint": "oxlint",
  "preview": "vite preview"
},
```

| コマンド | 実行内容 | いつ使う |
| --- | --- | --- |
| `npm run dev` | Vite の開発サーバを起動（デフォルト `http://localhost:5173`、HMR あり） | 開発中 |
| `npm run build` | `tsc -b` で型チェック → 成功したら `vite build` で `dist/` を生成 | デプロイ前 |
| `npm run lint` | oxlint でコードの問題を検出 | コミット前・CI |
| `npm run preview` | `dist/` を配信するローカルサーバを起動（デフォルト `http://localhost:4173`） | ビルド結果の動作確認 |
| `npm run build:study` | `../study` の学習ノートを VitePress でビルドし `dist/study` にコピー（後から追加。`web-app/vercel.json:3` の `buildCommand` で `npm run build` の後に実行される） | デプロイ時 |

ポート番号 5173 / 4173 は `web-app/node_modules/vite/dist/node/chunks/node.js` 内の定数 `DEFAULT_DEV_PORT = 5173` / `DEFAULT_PREVIEW_PORT = 4173` で確認できます。

詳細は [10](./10-vite-dev-server.md)、[12](./12-vite-build-and-typecheck.md)、[13](./13-vite-preview-and-dist.md)、[17](./17-oxlint-basics.md)。

### `&&` の意味

`tsc -b && vite build` の `&&` はシェルの演算子で、「**左が成功（終了コード 0）したときだけ右を実行**」します。型エラーがあれば `tsc` が失敗し、`vite build` は実行されません。

## 重要語句

- **npm scripts**: package.json に登録するコマンドのショートカット。
- **`node_modules/.bin`**: ローカルインストールしたパッケージの実行ファイル置き場。`npm run` 時に PATH に入る。
- **終了コード（exit code）**: コマンドの成否。0 が成功、それ以外が失敗。CI はこれで合否を判定する。
- **`npx`**: scripts に登録せずに `node_modules/.bin` のコマンドを一回だけ実行する方法（例: `npx oxlint --help`）。

## 仕様・注意点

- 引数を scripts に渡すには `--` を挟みます。例: `npm run dev -- --port 3001`（`vite --port 3001` として実行される）。
- `oxlint` は **warning だけなら終了コード 0** です。実際にこのプロジェクトで `npx oxlint` を実行すると warning が 2 件出ますが終了コードは 0 でした。CI で warning も失敗扱いにしたいなら `oxlint --deny-warnings` を使います（`npx oxlint --help` で確認）。
- backend には `lint` がなく、web-app には `start` がない、と 2 つのプロジェクトで揃っていません。
- `pre<name>` / `post<name>` という名前のスクリプトを置くと、`<name>` の前後に自動実行されます（例: `prebuild`）。便利ですが暗黙的なので多用は避けるのが無難です。

## 今後に活かせるポイント

- 初見のプロジェクトでは `scripts` を読めば「開発の始め方・ビルド方法・品質チェック方法」が分かる。README より正確なことが多い。
- `dev` / `build` / `start` / `lint` / `test` / `typecheck` / `format` といった**慣習的な名前**に合わせると、他の人や CI ツールが迷わない。

## 改善するなら

チェック系のスクリプトを揃えると、CI やコミット前フックから呼びやすくなります。

```json
// web-app/package.json（例）
"scripts": {
  "dev": "vite",
  "build": "tsc -b && vite build",
  "typecheck": "tsc -b",
  "lint": "oxlint --deny-warnings",
  "lint:fix": "oxlint --fix",
  "preview": "vite preview"
}
```

```json
// backend/package.json（例）
"scripts": {
  "dev": "tsx watch src/index.ts",
  "build": "tsc",
  "start": "node dist/index.js",
  "typecheck": "tsc --noEmit",
  "lint": "oxlint"
}
```

（backend で `oxlint` を使うには `npm install -D oxlint` が必要。）

## 次に学ぶこと

- `npm-run-all2` / `concurrently`：複数スクリプトの並列・直列実行
- Husky + lint-staged：コミット時に lint を自動実行
- GitHub Actions：push ごとに `npm run lint && npm run build` を自動実行する CI
