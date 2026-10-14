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
// backend/package.json:8-22
"dependencies": {
  "@hono/node-server": "^2.1.3",
  "@t3-oss/env-core": "^0.13.11",
  "@vercel/functions": "^3.10.0",
  "dotenv": "^18.0.7",
  "hono": "^4.13.13",
  "pg": "^8.23.1",
  "zod": "^4.6.6"
},
"devDependencies": {
  "@types/node": "^26.6.5",
  "@types/pg": "^8.23.1",
  "tsx": "^4.23.0",
  "typescript": "~6.0.2"
}
```

- `dependencies`: サーバが動くときに `import` されるもの。
  - `hono`, `zod`, `@t3-oss/env-core`：アプリ本体・環境変数の検証
  - `pg`：PostgreSQL への接続（`backend/src/index.ts:4`、→ `../PostgreSQL/06-node-postgres-pool-and-query.md`）
  - `@vercel/functions`：Vercel 上での DB 接続の後始末（`attachDatabasePool`、`backend/src/index.ts:3`）
  - `@hono/node-server`, `dotenv`：ローカル起動用の `src/dev.ts` だけが使う。Vercel 上の本番では `src/index.ts` の `app` が直接使われるため実質使われないが、`dev.ts` が `import` する実行時コードなので `dependencies` で問題ない
- `devDependencies`: `tsx`（開発時の実行）、`typescript`（`npm run typecheck` の型チェック）、`@types/node` / `@types/pg`（型定義）。**型を消した JS を動かすだけなら不要** です。

`typescript` は以前 `^7.0.2` でしたが、コミット `05cd00a`「TypeScript を 6.0 に下げる（Vercel のビルドが TS7 で @types/node を解決できないため）」で `~6.0.2` に変わりました（[04](./04-semver-caret-tilde.md)、[09](./09-backend-build-and-start.md)）。

`pg` は JS で書かれたライブラリなので、型定義は別パッケージの `@types/pg` に入っています（`hono` や `zod` は自前で型を同梱しているので `@types/*` が要らない）。

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
  - backend: `@types/node` `^26.6.5`（`backend/package.json:18`）
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
- `optionalDependencies`（OS ごとのネイティブバイナリ配布で使われる。esbuild・oxlint・TypeScript 7 などがこの方式。backend は以前 TypeScript 7 を使っていたが、現在は JS 実装の 6.0 系）
- Docker のマルチステージビルドで devDependencies を本番イメージから除く方法
