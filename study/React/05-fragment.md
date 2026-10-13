# Fragment（`<>...</>`）

## 概要

JSX はコンポーネントから **1 つの要素しか返せません**。でも「ヘッダーとメイン部分を並べて返したい」ことはよくあります。そのとき、余計な `<div>` を増やさずに複数の要素をまとめるのが **Fragment** です。

## このプロジェクトでの実装

`web-app/src/pages/Home.tsx:21-51`

```tsx
return (
  <>
    <Header />
    <Container as="main" maxW="4xl" py={6}>
      {/* ... */}
    </Container>
  </>
);
```

`web-app/src/pages/Input.tsx:53-137` も同じく `<>` で `<Header />` と `<Container>` を並べています。

- `<>` と `</>` が Fragment の短縮記法です。
- 実際の HTML には何も出力されません。ブラウザの DOM を見ると、`<header>` と `<main>` が `#root` の直下にそのまま並びます。
- もし `<div>` で包んでいたら、`<div><header/><main/></div>` と余計な階層が 1 つ増えます。

## 重要語句

| 用語 | 意味 |
| --- | --- |
| Fragment | 複数の要素をまとめるが、DOM には何も出力しない React の部品 |
| `<>...</>` | `<Fragment>...</Fragment>` の短縮記法 |
| `Fragment` | `import { Fragment } from "react"` で使う正式名。`key` を渡したいときに使う |

## 仕様・注意点

- **短縮記法 `<>` には `key` などの属性を書けません。** リストの中で Fragment を使い、`key` を付けたいときは `<Fragment key={id}>` と正式名で書きます。

  ```tsx
  import { Fragment } from "react";

  {transactions.map((t) => (
    <Fragment key={t.id}>
      <dt>{t.item}</dt>
      <dd>{t.amount}</dd>
    </Fragment>
  ))}
  ```

- 余計な `<div>` は CSS のレイアウト（Flex や Grid の親子関係）を崩したり、`<ul>` の直下に `<li>` 以外が入るなど HTML として不正になったりする原因になります。Fragment ならその心配がありません。
- 逆に、レイアウトやスタイルのための「箱」が本当に必要なら、Fragment ではなく `Box`（`div`）などを使います。

## 今後に活かせるポイント

- 「ページ = 共通ヘッダー + メインコンテンツ」のような並列構造は Fragment で返すのが定番。
- テーブルの行（`<tr>`）や定義リスト（`<dt>`/`<dd>`）を複数返すコンポーネントでは、Fragment が必須に近い。

## 改善するなら

`Home.tsx` と `Input.tsx` の両方で「`<Header />` + `<Container as="main" maxW="4xl" py={6}>`」という同じ構造を繰り返しています。共通レイアウトとして切り出すと、Fragment もそこに集約できます（children については 07 参照）。

```tsx
// components/PageLayout.tsx
import type { ReactNode } from "react";
import { Container } from "@chakra-ui/react";
import { Header } from "./Header";

export const PageLayout = ({ children }: { children: ReactNode }) => (
  <>
    <Header />
    <Container as="main" maxW="4xl" py={6}>
      {children}
    </Container>
  </>
);
```

なお React Router のネストしたルートと `<Outlet />` を使って共通レイアウトを作る方法もあります（study/Routing 参照）。

## 次に学ぶこと

- **React Router のレイアウトルート**: ルート定義で共通レイアウトを適用する方法。
- **`Children` API / 配列を返すコンポーネント**: Fragment 以外に複数要素を扱う方法（使う場面は少ない）。
