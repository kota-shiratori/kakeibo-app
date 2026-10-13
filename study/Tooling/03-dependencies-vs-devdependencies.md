# dependencies と devDependencies の違い

## 概要

`package.json` の依存パッケージは 2 つの欄に分けて書きます。

| 欄 | 入れるもの | 追加コマンド |
| --- | --- | --- |
| `dependencies` | **アプリの実行時に必要**なもの（本番でも使う） | `npm install <pkg>` |
| `devDependencies` | **開発・ビルド時だけ必要**なもの（型定義、コンパイラ、Linter、開発サーバ） | `npm install -D <pkg>` |

`npm install --omit=dev`（本番用インストール）を実行すると `devDependencies` は入りません。サーバにデプロイするときに容量・時間・攻撃面を減らせるのが分ける理由です。

## このプロジェクトでの実装

### backend

```json
// backend/package.json:9-20
"dependencies": {
  "@hono/node-server": "^2.1.3",
  "@t3-oss/env-core": "^0.13.11",
  "dotenv": "^18.0.7",
  "hono": "^4.13.13",
  "zod": "^4.6.6"
},
"devDependencies": {
  "@types/node": "^26.6.5",
  "tsx": "^4.23.0",
  "typescript": "^7.0.2"
}
```

- `dependencies`: サーバが動くときに `import` されるもの（`hono`, `@hono/node-server`, `dotenv`, `zod`, `@t3-oss/env-core`）。`node dist/index.js` 実行時に必要です。
- `devDependencies`: `tsx`（開発時の実行）、`typescript`（`tsc` によるビルド）、`@types/node`（型定義）。**ビルド後の JS を動かすだけなら不要**です。

この分け方は理想的で、「ビルド → `npm install --omit=dev` → `node dist/index.js`」という本番フローが成立します。

### web-app

```json
// web-app/package.json:13-29
"dependencies": {
  "@chakra-ui/react": "^3.37.0",
  "@emotion/react": "^11.14.0",
  "react": "^19.2.8",
  "react-dom": "^19.2.8",
  "react-icons": "^5.7.0",
  "react-router": "^7.18.4"
},
"devDependencies": {
  "@types/node": "^24.13.3",
  "@types/react": "^19.2.18",
  "@types/react-dom": "^19.2.7",
  "@vitejs/plugin-react": "^6.1.1",
  "oxlint": "^1.81.0",
  "typescript": "~6.0.2",
  "vite": "^8.3.0"
}
```

フロントエンドでは少し事情が違います。**ブラウザで動くのは `vite build` が出力した `dist/` の JS** であり、React なども全部その中に**バンドル（同梱）**されます。つまり本番サーバに `node_modules` は不要で、厳密には全部ビルド時にしか使いません。

それでも慣習として、

- ブラウザに届くコード（`react`, `@chakra-ui/react` など）→ `dependencies`
- ツール類（`vite`, `typescript`, `oxlint`, `@types/*`）→ `devDependencies`

と分けます。「何がユーザーに届くのか」が一目で分かるからです。

## 重要語句

- **dependencies**: 実行時依存。
- **devDependencies**: 開発時依存。
- **`@types/xxx`**: JavaScript 製ライブラリに後付けで型を付ける型定義パッケージ（DefinitelyTyped）。実行時には使わないので常に devDependencies。
- **バンドル**: 複数のファイルと依存ライブラリを、ブラウザ向けに少数のファイルへまとめる処理。
- **`--omit=dev`**: devDependencies を入れない npm install のオプション。

## 仕様・注意点

- `npm install`（引数なし）はデフォルトで **両方** をインストールします。
- 分類を間違えても開発中は気づきません。たとえば backend で `hono` を devDependencies に入れてしまうと、本番で `--omit=dev` したときに初めて「モジュールが見つからない」エラーになります。
- **`@types/node` のメジャーバージョンは、実際に使う Node.js のメジャーバージョンに合わせる**のが原則です。このリポジトリでは
  - backend: `@types/node` `^26.6.5`（`backend/package.json:17`）
  - web-app: `@types/node` `^24.13.3`（`web-app/package.json:22`）
  - 実行環境の Node.js: v22.12.0（この環境で `node -v` を実行して確認）

  と、3 つともバラバラです。型定義のほうが新しいと、「型チェックは通るのに、Node 22 には存在しない API を使っていて実行時に落ちる」ことがあり得ます。

## 今後に活かせるポイント

- パッケージを追加するときは「これは**実行時に import されるか**？」を自問して `-D` を付けるか決める。
- バックエンドとフロントエンドで「本番に何が届くか」の仕組みが違う（node_modules を使う vs. dist にバンドル済み）ことを理解しておく。

## 改善するなら

- `@types/node` を実行環境の Node.js に揃える。例: Node 22 を使うなら両方 `"@types/node": "^22.x"`。あわせて Node のバージョン自体も `.nvmrc` や Volta（`"volta": { "node": "22.12.0" }`）で固定すると、チーム全員が同じ環境になる。
- web-app の `@types/node` は `vite.config.ts` の型チェック（`web-app/tsconfig.node.json:6` の `"types": ["node"]`）のためにあるので、削除はしないこと。

## 次に学ぶこと

- `peerDependencies`（プラグインが「本体はあなたが入れてね」と要求する仕組み。`@vitejs/plugin-react` は `vite: ^8.0.0` を peer に要求している）
- `optionalDependencies`（OS ごとのネイティブバイナリ配布で使われる。esbuild・oxlint・TypeScript 7 などがこの方式）
- Docker のマルチステージビルドで devDependencies を本番イメージから除く方法
