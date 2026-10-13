# React Router v7 の 3 つのモード（Declarative / Data / Framework）

## 概要

React Router v7 は使い方が 3 種類（モード）あり、**どの「トップレベルのルーター API」を使うかでモードが決まります**。公式ドキュメント `node_modules/react-router/docs/start/modes.md` の説明を要約します。

| モード | トップレベル API | できること |
| --- | --- | --- |
| **Declarative** | `<BrowserRouter>` | URL とコンポーネントの対応付け、`<Link>` / `useNavigate` / `useLocation` による遷移、アクティブ状態の表示など **基本的なルーティング** |
| **Data** | `createBrowserRouter` + `<RouterProvider>` | Declarative の機能 + ルート定義を React の描画の外に出し、`loader`（データ取得）、`action`（データ更新）、ペンディング状態、`useFetcher` など **データ機能** |
| **Framework** | Vite プラグイン（`@react-router/dev`）+ `routes.ts` | Data の機能 + 型安全なルートモジュール、自動コード分割、SPA / SSR / 静的レンダリングの選択など **フレームワークとしての全機能** |

公式ドキュメントの言葉では、機能は「additive（積み上げ式）」で、Declarative → Data → Framework と進むほど機能が増える代わりに、アーキテクチャを自分で制御できる範囲は減ります。

## このプロジェクトでの実装

このプロジェクトは `<BrowserRouter>` を使っているので **Declarative モード** です。

```tsx
// web-app/src/App.tsx:1-15
import { BrowserRouter, Route, Routes } from "react-router";
import Home from "@/pages/Home";
import Input from "@/pages/Input";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/input" element={<Input />} />
      </Routes>
    </BrowserRouter>
  );
}
export default App;
```

判断のポイント:

- `createBrowserRouter` や `RouterProvider` が出てこない → Data モードではない
- `vite.config.ts` に React Router の Vite プラグインがなく、`routes.ts` もない → Framework モードではない（`web-app/vite.config.ts:5-10` は `@vitejs/plugin-react` のみ）

データ取得も React Router の `loader` ではなく、自作のカスタムフック内の `useEffect` + `fetch` で行っています（`web-app/src/hooks/useIncomeTransactions.ts:30-32` など）。これも Declarative モードらしい構成です。

## 重要語句

- **Declarative モード**: JSX の `<Routes>` / `<Route>` でルートを宣言するモード。v6 の `<BrowserRouter>` と同じ使い方。
- **Data モード**: `createBrowserRouter([...])` でルートをオブジェクト配列として定義し、`loader` / `action` を使えるモード。v6.4 で導入された「data router」に相当。
- **Framework モード**: React Router を Next.js のようなフレームワークとして使うモード。Remix v2 の後継。
- **loader**: ルートに入る前にデータを取得する関数（Data / Framework モード）。
- **action**: フォーム送信などでデータを更新する関数（Data / Framework モード）。

## 仕様・注意点

- **モードごとに使える API が違います**。`modes.md` 末尾の「API + Mode Availability Table」によると、例えば次のとおりです。
  - Declarative でも使える: `Link`, `NavLink`, `Navigate`, `Outlet`, `Route`, `Routes`, `useNavigate`, `useLocation`, `useParams`, `useSearchParams` など
  - Declarative では使えない: `useLoaderData`, `useActionData`, `useFetcher`, `useNavigation`, `useBlocker`, `Form`, `ScrollRestoration`, `redirect` など
- `<Route>` の型定義には `loader` や `action` という props も存在しますが、`<Routes>` の JSDoc に「these routes do not participate in data loading, action, code splitting, or any other route module features」とあるとおり、**Declarative モードの `<Routes>` 内では動作しません**。
- `useNavigate` の実装も Declarative と Data/Framework で異なります（`useNavigate` の JSDoc より）。Declarative では返り値が `void`、Data/Framework では遷移完了時に解決する `Promise` を返し、関数の参照も遷移をまたいで安定します。
- 記事を読むときは「どのモードの話か」を必ず確認しましょう。公式ドキュメントは各ページ冒頭に `[MODES: framework, data, declarative]` のように対象モードを明記しています。

## 今後に活かせるポイント

- 小さなアプリや学習用途では Declarative モードで十分です。ルーティングだけをシンプルに任せたいときに選びます。
- データ取得のローディング・エラー処理をルート単位で整理したくなったら Data モード、SSR や型安全なルートが欲しくなったら Framework モード、と段階的に検討できます。公式の判断基準（Decision Advice）では、「Declarative を選ぶのは、React Router をできるだけシンプルに使いたいとき、v6 の `<BrowserRouter>` で満足しているとき」などとされています。

## 改善するなら

現状のままで問題はありませんが、Data モードへ移行すると「登録後に一覧を再取得する」処理を React Router に任せられます。移行の雰囲気だけ示します（実際の移行時は公式ドキュメントで確認すること）。

```tsx
// Data モードの例（概念図）
import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";

const router = createBrowserRouter([
  { path: "/", Component: Home, loader: async () => fetchTransactions() },
  { path: "/input", Component: Input, action: async ({ request }) => { /* 登録 */ } },
]);

createRoot(document.getElementById("root")!).render(<RouterProvider router={router} />);
```

## 次に学ぶこと

- `createBrowserRouter` + `loader` / `action` / `useLoaderData`（`docs/start/data/`）
- Framework モード（`docs/start/framework/`）と `routes.ts`、ルートモジュールの型安全
