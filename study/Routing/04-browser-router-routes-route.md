# BrowserRouter / Routes / Route（path, element）

## 概要

Declarative モードのルーティングは 3 つの部品で組み立てます。

| 部品 | 役割 | たとえ |
| --- | --- | --- |
| `<BrowserRouter>` | History API で URL を管理し、現在の location を子孫に配る | 道路網全体の管理者 |
| `<Routes>` | 子の `<Route>` の中から、現在の URL に **最もよく一致する 1 つ** を選んで描画する | 交差点の案内係 |
| `<Route>` | 「この `path` ならこの `element` を表示」という 1 つのルール | 道路標識 |

## このプロジェクトでの実装

```tsx
// web-app/src/App.tsx:5-14
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
```

- `web-app/src/App.tsx:7` `<BrowserRouter>` … アプリ全体をルーターで包む。これより内側でルーター系フックが使える。
- `web-app/src/App.tsx:8` `<Routes>` … ルート候補の入れ物。
- `web-app/src/App.tsx:9` `path="/"` → `<Home />`（収入・支出の一覧画面）
- `web-app/src/App.tsx:10` `path="/input"` → `<Input />`（登録フォーム画面）

`element` には **コンポーネントそのもの（`Home`）ではなく、JSX 要素（`<Home />`）** を渡します。props を渡したい場合は `element={<Home title="..." />}` のように書けます。

また、`BrowserRouter` は `web-app/src/main.tsx:6-12` で `ChakraProvider` の内側に置かれています。

```tsx
// web-app/src/main.tsx:6-12
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ChakraProvider value={defaultSystem}>
      <App />   {/* ← この中に BrowserRouter がある */}
    </ChakraProvider>
  </StrictMode>,
);
```

### 描画の流れ（URL が `/input` のとき）

1. `BrowserRouter` が現在の location（`pathname: "/input"`）を持つ
2. `Routes` が子の `Route` 一覧から `/input` に一致するものを探す
3. `path="/input"` が一致 → `<Input />` を描画
4. `path="/"` の `<Home />` は描画されない（アンマウントされる）

## 重要語句

- **BrowserRouter**: History API（`pushState` など）を使うルーター。props は `basename`, `children`, `window`, `useTransitions`。
- **basename**: アプリをサブパス（例: `/kakeibo/`）に配置するときの接頭辞。`<BrowserRouter basename="/kakeibo">`。
- **Routes**: 一致するルートを 1 つ選んで描画するコンポーネント。一致するものがなければ `null`（何も描画しない）を返す。
- **Route**: `path` と `element` の組。ネストしてレイアウトを作ったり（[12-layout-route-and-outlet.md](./12-layout-route-and-outlet.md)）、`index` で親の既定子ルートにしたりできる。
- **element**: 一致したときに描画する React 要素。
- **path**: 一致させる URL パターン。`:id`（動的セグメント）、`*`（スプラット）、`?`（任意セグメント）が使える。

## 仕様・注意点

- **`Route` の並び順は（基本的に）結果に影響しません**。v6 以降の React Router は、パスの「具体性」に点数を付けて最適なルートを選びます（実装 `rankRouteBranches` では静的セグメント 10 点、動的セグメント 3 点、`*` は減点など）。v5 の `<Switch>` のように「上から順に最初に一致したもの」ではありません。
- `path="/"` は v6 以降、**`/` だけに完全一致** します（v5 のように `exact` を付ける必要はありません。`exact` prop は存在しません）。なので `/input` で `Home` が同時に表示されることはありません。
- `<Route>` は `<Routes>`（または親の `<Route>`）の直下にしか置けません。`<Routes>` の外に `<Route>` を単独で書くとエラーになります。
- v5 では `component={Home}` や `render` を使いましたが、v6 以降は `element={<Home />}` です（Data モードでは `Component: Home` も使えます）。
- `path` の大文字小文字は既定で区別しません。区別したいときは `caseSensitive` を付けます。

## 今後に活かせるポイント

- 画面が増えたら `<Route path="/xxx" element={<Xxx />} />` を 1 行足すだけ、というシンプルさが Declarative モードの魅力です。
- ページ用コンポーネントは `pages/` に、ページから使う部品は `components/` に置くこのプロジェクトの分け方は、ルーティングと相性の良い構成です。

## 改善するなら

ルートのパス文字列が `App.tsx` と各ページの `navigate("/input")` などに散らばっています。定数にまとめると、パス変更時の修正漏れやタイプミスを防げます。

```ts
// web-app/src/routes/paths.ts（例）
export const PATHS = {
  home: "/",
  input: "/input",
} as const;
```

```tsx
// App.tsx
<Route path={PATHS.home} element={<Home />} />
<Route path={PATHS.input} element={<Input />} />

// Home.tsx
navigate(PATHS.input);
```

## 次に学ぶこと

- ネストルートと `<Outlet />`、`index` ルート（[12-layout-route-and-outlet.md](./12-layout-route-and-outlet.md)）
- 動的セグメント `:id` と `useParams`（例: `/transactions/:id/edit` で編集画面を作る）
- `useRoutes`（JSX ではなくオブジェクト配列でルートを定義するフック。Declarative モードでも使える）
