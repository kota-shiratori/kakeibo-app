# レイアウトルートと Outlet（Header の共通化）

## 概要

React Router では `<Route>` を **入れ子（ネスト）** にできます。親ルートの `element` の中に **`<Outlet />`** を置くと、そこに「今の URL に一致した子ルートの `element`」が差し込まれます。

さらに、**`path` を持たない `<Route element={...}>`** は「**レイアウトルート**」と呼ばれ、URL には何も追加せずに子ルートを共通のレイアウトで包むことができます（`docs/start/declarative/routing.md` の Layout Routes より: 「Routes without a path create new nesting for their children, but they don't add any segments to the URL.」）。

これを使うと、ヘッダーやフッターのような **全ページ共通の部品を 1 か所にまとめられます**。`Outlet` と `<Route>` のネストは Declarative モードでも使えます。

## このプロジェクトでの実装

現状はネストを使わず、各ページの中で `Header` を個別に描画しています。

```tsx
// web-app/src/App.tsx:8-11
<Routes>
  <Route path="/" element={<Home />} />
  <Route path="/input" element={<Input />} />
</Routes>
```

```tsx
// web-app/src/pages/Home.tsx:21-24
return (
  <>
    <Header />
    <Container as="main" maxW="4xl" py={6}>
```

```tsx
// web-app/src/pages/Input.tsx:53-56
return (
  <>
    <Header />
    <Container as="main" maxW="4xl" py={6}>
```

`Header`（`web-app/src/components/Header.tsx:3-18`）と `<Container as="main" maxW="4xl" py={6}>` が **両方のページで重複** しています。ページを追加するたびに同じ記述をコピーする必要があり、書き忘れるとそのページだけヘッダーが無くなります。また、ページ遷移のたびに `Header` もアンマウント → マウントされます（[10-routing-remount-and-refetch.md](./10-routing-remount-and-refetch.md)）。

## 重要語句

- **ネストルート（nested routes）**: `<Route>` の中に `<Route>` を書くこと。親の `path` は子に自動で連結される（`path="dashboard"` の子 `path="settings"` → `/dashboard/settings`）。
- **Outlet**: 親ルートの `element` 内で「子ルートの表示位置」を示すコンポーネント。
- **レイアウトルート（layout route）**: `path` を持たず `element` だけを持つ親ルート。URL に影響せず、子を共通レイアウトで包む。
- **index ルート**: `index` prop を持つ子ルート。親の URL ちょうどのときに親の `<Outlet />` に表示される「既定の子」。index ルートは子を持てない。
- **useOutletContext**: 親の `<Outlet context={...} />` から渡した値を子ルートで受け取るフック。

## 仕様・注意点

- 親ルートの `element` に `<Outlet />` を置き忘れると、**子ルートが一致しても何も表示されません**。ネストしたのに表示されないときはまず `Outlet` を確認します。
- 親の `path` は子に連結されるため、子では先頭の `/` を付けない相対パス（`path="input"`）で書くのが一般的です。
- レイアウトルートの中のコンポーネント（`Header` など）は、**子ルート間を移動してもアンマウントされず維持** されます。差し替わるのは `Outlet` の部分だけです。逆に言えば、子ページの再マウントによる再取得（[10-routing-remount-and-refetch.md](./10-routing-remount-and-refetch.md)）はそのまま働きます。
- v5 ではネストしたルートを子コンポーネントの中にも `<Switch>` で書く必要がありましたが、v6 以降はルート定義を 1 か所にまとめて `Outlet` で描画できます。

## 今後に活かせるポイント

- 「全ページ共通」「ログイン後の画面だけ共通」「管理画面だけ別レイアウト」など、**レイアウトの単位でルートをグループ化** できるのがネストルートの強みです。認証ガード（ログインしていなければリダイレクト）もレイアウトルートで実現するのが定番です。
- 共通部品を各ページに書くか、レイアウトルートにまとめるかは、ページ数が 3 つを超えたあたりから差が出てきます。

## 改善するなら

`Header` と `main` の枠をレイアウトコンポーネントにまとめ、レイアウトルートで全ページを包みます。

```tsx
// web-app/src/components/AppLayout.tsx（例）
import { Container } from "@chakra-ui/react";
import { Outlet } from "react-router";
import { Header } from "@/components/Header";

export function AppLayout() {
  return (
    <>
      <Header />
      <Container as="main" maxW="4xl" py={6}>
        <Outlet /> {/* ← ここに Home や Input が入る */}
      </Container>
    </>
  );
}
```

```tsx
// web-app/src/App.tsx（例）
import { BrowserRouter, Route, Routes } from "react-router";
import { AppLayout } from "@/components/AppLayout";
import Home from "@/pages/Home";
import Input from "@/pages/Input";
import NotFound from "@/pages/NotFound";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>          {/* path なし = レイアウトルート */}
          <Route index element={<Home />} />     {/* "/" */}
          <Route path="input" element={<Input />} /> {/* "/input" */}
          <Route path="*" element={<NotFound />} />  {/* それ以外 */}
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
```

これに合わせて `Home.tsx` / `Input.tsx` からは `<Header />` と `<Container as="main" ...>` を取り除き、中身だけを返すようにします。

補足: レイアウトルートを使わず、単純に `<BrowserRouter>` の中・`<Routes>` の外に `<Header />` を置く方法もあります。全ページ共通で例外がないならこれでも十分ですが、「この画面だけヘッダーなし」といった分岐が必要になったときはレイアウトルートの方が柔軟です。

```tsx
<BrowserRouter>
  <Header />
  <Routes>...</Routes>
</BrowserRouter>
```

## 次に学ぶこと

- 認証ガード用のレイアウトルート（未ログインなら `<Navigate to="/login" replace />`）
- `useOutletContext` で親レイアウトから子ページへ値を渡す
- 動的セグメントとの組み合わせ（`/transactions/:id` と `/transactions/:id/edit` を共通レイアウトで包む）
