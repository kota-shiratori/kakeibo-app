# tsconfig の `jsxImportSource: "hono/jsx"` の意味

## 概要

Hono には **React に依存しない独自の JSX 実装（`hono/jsx`）** が入っています。サーバー側で JSX を書いて HTML を生成（SSR）したり、`c.html(<Page />)` のように返したりできます。

TypeScript でその JSX を使うために、tsconfig で「JSX を変換するときにどのモジュールの関数を呼ぶか」を指定しているのが `jsxImportSource` です。

## このプロジェクトでの実装

`backend/tsconfig.json`（11-12 行目）

```json
"jsx": "react-jsx",
"jsxImportSource": "hono/jsx",
```

| 設定 | 意味 |
| --- | --- |
| `"jsx": "react-jsx"` | React 17 以降の「自動ランタイム」方式で JSX を変換する。`React.createElement` ではなく、`<jsxImportSource>/jsx-runtime` から `jsx()` 関数を自動 import するコードを生成する |
| `"jsxImportSource": "hono/jsx"` | その自動 import 先を `react` ではなく `hono/jsx` にする → `hono/jsx/jsx-runtime` から import される |

`hono` パッケージの `package.json` の `exports` に `"./jsx/jsx-runtime"` と `"./jsx/jsx-dev-runtime"` が定義されており、この設定で解決できることを確認しました。

**ただし、現在の backend には `.tsx` ファイルが 1 つもありません**（`backend/src/` は `index.ts` と `env.ts` のみ）。つまりこの設定は **今は使われておらず**、`create-hono` の Node.js テンプレートに最初から入っている設定がそのまま残っていると考えられます。JSON API サーバーとして使う限り、あっても害はありません。

## 重要語句

| 用語 | 意味 |
| --- | --- |
| JSX | `<div>...</div>` のような HTML 風の構文。そのままでは JS ではないので変換が必要 |
| JSX 変換（トランスパイル） | JSX を関数呼び出しに置き換えること。`<p>hi</p>` → `jsx("p", { children: "hi" })` |
| 自動ランタイム（`react-jsx`） | 変換結果に `import { jsx } from "<source>/jsx-runtime"` を自動挿入する方式 |
| `jsxImportSource` | 自動ランタイムの import 元。React なら `react`、Hono なら `hono/jsx` |
| `hono/jsx` | Hono 組み込みの JSX 実装。サーバーでは HTML 文字列を生成する |
| `hono/jsx/dom` | ブラウザで動くクライアント用 JSX 実装（React 風のフック付き） |

## 仕様・注意点

- **フロントエンドの React とは別物**。web-app 側の JSX は React（`react/jsx-runtime`）で変換されます。backend の `hono/jsx` 設定はフロントには影響しません（tsconfig はプロジェクトごとに独立）。React 側の設定は `study/React` / `study/TypeScript` を参照。
- ファイル単位で切り替えたいときは、ファイル先頭に `/** @jsxImportSource hono/jsx */` のようなプラグマコメントを書く方法もあります。
- 開発時に使っている `tsx`（esbuild ベース）も tsconfig の `jsx` / `jsxImportSource` を読んで変換します。
- `hono/jsx` のコンポーネントは **サーバーで HTML 文字列にレンダリングされる** のが基本で、`useState` などをブラウザで動かしたい場合は `hono/jsx/dom` を使う別の構成が必要です。

## 今後に活かせるポイント

API だけでなく、簡単な管理画面やメールテンプレートを Hono だけで作りたいときに使えます。

```tsx
// src/pages.tsx（拡張子 .tsx が必要）
import type { FC } from "hono/jsx";

const Layout: FC = (props) => (
  <html>
    <body>{props.children}</body>
  </html>
);

app.get("/health", (c) =>
  c.html(
    <Layout>
      <h1>OK</h1>
    </Layout>,
  ),
);
```

## 改善するなら

- 当面 JSX を使う予定がないなら、`jsx` / `jsxImportSource` を削除して設定をシンプルにする選択肢があります（「なぜこの設定があるのか」と迷う人を減らせる）。
- 逆に残すなら、README などに「将来 hono/jsx で SSR する場合の設定」と一言書いておくと親切です。

## 次に学ぶこと

- `jsxRenderer` ミドルウェア（`hono/jsx-renderer`）と `c.render()` でレイアウトを共通化
- `hono/html` の `html` タグ付きテンプレート（JSX を使わない HTML 生成）
- HonoX: Hono ベースのフルスタックフレームワーク（ファイルベースルーティング + アイランド）
