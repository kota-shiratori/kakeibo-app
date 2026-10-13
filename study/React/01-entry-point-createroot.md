# エントリーポイントと createRoot

## 概要

React アプリは「HTML の中の 1 つの DOM 要素」を React に明け渡し、その中身をすべて React が描画する、という形で動きます。
その「明け渡し」を行うのが `react-dom/client` の `createRoot` で、これを呼ぶファイル（このプロジェクトでは `main.tsx`）を **エントリーポイント** と呼びます。

アプリの起動順を理解しておくと、「なぜ Provider は一番外側に置くのか」「なぜ `index.html` に `<div id="root">` しかないのか」が分かるようになります。

## このプロジェクトでの実装

### 1. HTML 側: 空の入れ物と、スクリプトの読み込み

`web-app/index.html:10-11`

```html
<div id="root"></div>
<script type="module" src="/src/main.tsx"></script>
```

- `<div id="root"></div>` は中身が空の「入れ物」。ここに React が画面を作ります。
- `<script type="module" src="/src/main.tsx">` で、エントリーポイントの TypeScript ファイルを読み込みます（`.tsx` をブラウザが読めるように変換するのは Vite の仕事。詳細は study/Tooling 参照）。

### 2. main.tsx: React のルートを作って描画する

`web-app/src/main.tsx:1-12`

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ChakraProvider value={defaultSystem}>
      <App />
    </ChakraProvider>
  </StrictMode>,
);
```

処理の流れは次の 3 ステップです。

1. `document.getElementById("root")` で、index.html の `<div id="root">` を取得する。
2. `createRoot(要素)` で、その要素を React の管理下に置く **Root** オブジェクトを作る。
3. `.render(JSX)` で、描画したいコンポーネントツリーを渡す。

ツリーの形は外側から順に:

```
StrictMode            … 開発時のチェック機能（02 参照）
└ ChakraProvider      … Chakra UI のテーマを配る（study/ChakraUI 参照）
  └ App               … ルーティング（study/Routing 参照）
    └ Home / Input    … 各ページ
```

「全ページで使いたいもの（テーマ・ルーター・状態の共有など）」は、このように一番外側に近いところで包むのが定石です。

`getElementById(...)` の後ろの `!` は TypeScript の「null ではないと断言する」記法です（study/TypeScript 参照）。`getElementById` は要素が見つからないと `null` を返すため、型の上では `HTMLElement | null` になっています。

## 重要語句

| 用語 | 意味 |
| --- | --- |
| エントリーポイント | アプリで最初に実行されるファイル。ここでは `src/main.tsx` |
| `createRoot` | `react-dom/client` が提供する関数。DOM 要素を受け取り、React の Root を作る |
| Root | `render()`（描画）と `unmount()`（破棄）を持つオブジェクト |
| `render()` | Root にコンポーネントツリーを渡して描画させるメソッド |
| `react` と `react-dom` | `react` は部品の作り方（コンポーネント・フック）、`react-dom` はそれをブラウザの DOM に反映する役。役割が分かれている |

## 仕様・注意点

- **React 18 以降の書き方**です。以前の `ReactDOM.render(<App />, el)` は React 18 で非推奨になり、**React 19 で削除**されました。古い記事のコードはそのまま動かないので注意。
- import 元は `react-dom` ではなく **`react-dom/client`** です。
- `createRoot` は第 2 引数でオプションを受け取れます。`@types/react-dom`（このプロジェクトでは 19.x）の型定義には `onUncaughtError` / `onCaughtError` / `onRecoverableError` があり、エラー発生時のログ送信などに使えます（`node_modules/@types/react-dom/client.d.ts` の `RootOptions`）。
- `createRoot` は 1 つの DOM 要素に対して 1 回だけ呼ぶものです。同じ要素に何度も呼ぶと警告が出ます。
- このプロジェクトの `package.json` は `"react": "^19.2.8"` ですが、`^` 指定なので実際に `node_modules` に入っているのは 19.3.0 でした（`node_modules/react/package.json` で確認）。バージョンを調べるときは `package.json` だけでなく実際のインストール版も確認しましょう。

## 今後に活かせるポイント

- 新しいプロジェクトでも「`index.html` の空 div」+「`main.tsx` で `createRoot(...).render(...)`」という構成はほぼ共通です（Vite のテンプレートもこの形）。
- アプリ全体に効かせたい Provider（テーマ、ルーター、TanStack Query の `QueryClientProvider` など）は `main.tsx` か `App.tsx` の外側に積み重ねていきます。

## 改善するなら

`!` で null を握りつぶすと、万一 `id` を書き間違えたときに `createRoot` 内部で分かりにくいエラーになります。明示的にチェックすると原因がすぐ分かります。

```tsx
const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error('index.html に <div id="root"> が見つかりません');
}

createRoot(rootElement).render(
  <StrictMode>
    <ChakraProvider value={defaultSystem}>
      <App />
    </ChakraProvider>
  </StrictMode>,
);
```

また、予期しないエラーを記録したい場合は `createRoot` のオプションを使えます。

```tsx
createRoot(rootElement, {
  onUncaughtError: (error, errorInfo) => {
    console.error("捕捉されなかったエラー", error, errorInfo.componentStack);
  },
});
```

## 次に学ぶこと

- **Error Boundary**: 描画中のエラーを画面単位で受け止め、代わりの表示を出す仕組み。
- **`hydrateRoot`**: サーバーで作った HTML に React を「後付け」する API（SSR / Next.js などで使われる）。
- **Portal（`createPortal`）**: モーダルなどを Root の外の DOM に描画する仕組み。
