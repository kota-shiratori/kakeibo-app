# Container と Center（中央寄せのレイアウト部品）

## 概要

- **`Container`**: コンテンツの最大幅を制限して、左右中央に配置する部品。左右に適度な余白（padding）も自動で付きます。ページ本体を包むのによく使います。
- **`Center`**: 子要素を縦横の中央に配置する部品（`display: flex` + `align-items: center` + `justify-content: center`）。

## このプロジェクトでの実装

### Container

`web-app/src/pages/Home.tsx:24` と `web-app/src/pages/Input.tsx:56`

```tsx
<Container as="main" maxW="4xl" py={6}>
```

`Container` のレシピ（`dist/esm/theme/recipes/container.js`）を見ると、既定のスタイルは次の通りです。

```js
base: {
  position: "relative",
  maxWidth: "8xl",           // 既定の最大幅 90rem（1440px）
  w: "100%",
  mx: "auto",                // 左右 margin auto で中央寄せ
  px: { base: "4", md: "6", lg: "8" }   // 左右の余白（画面幅で 16px → 24px → 32px）
},
variants: {
  centerContent: { true: { display: "flex", flexDirection: "column", alignItems: "center" } },
  fluid: { true: { maxWidth: "full" } }
}
```

このプロジェクトでは `maxW="4xl"`（56rem = 896px）で既定の `8xl` を上書きしています。つまり「幅 100%、ただし最大 896px、左右中央、左右に余白あり」のメイン領域になります。

### Center

`web-app/src/pages/Input.tsx:57-134`

```tsx
<Center>
  <VStack maxW="xl" width="full" gap={4} as="form" onSubmit={handleSubmit}>
    ...
  </VStack>
</Center>
```

`Center` の実装（`dist/esm/components/center/center.js`）:

```js
const Center = chakra("div", {
  base: { display: "flex", alignItems: "center", justifyContent: "center" },
  variants: { inline: { true: { display: "inline-flex" } } }
});
```

最大幅 576px（`maxW="xl"`）のフォームを、896px の Container の中で左右中央に置くために使っています。

## 重要語句

| 語句 | 意味 |
| --- | --- |
| `Container` | 最大幅 + 中央寄せ + 左右 padding を持つ外枠 |
| `centerContent` | Container の子を縦並び・中央揃えにするバリアント |
| `fluid` | Container の最大幅制限を外す（`maxWidth: full`）バリアント |
| `Center` | flex で子を中央に置く部品 |
| `mx="auto"` | 左右 margin を auto にしてブロック要素を中央寄せする定番テクニック |

## 仕様・注意点

- **v2 との違い**: v2 の Container は既定の最大幅が `60ch` 程度でしたが、v3 のレシピでは `maxWidth: "8xl"`（1440px）です（v3 の値は上記レシピで確認）。v2 の記事を参考にすると幅の感覚がずれるので注意。
- Container は左右 padding を持つので、背景色を画面端まで広げたい要素（ヘッダーなど）は Container の外に置きます。このプロジェクトでも `<Header />` は Container の外にあり、正しい構成です。
- `Center` の中に `width="full"` の要素を置く場合、`maxW` が効いて初めて「中央に寄る」見た目になります。`maxW` がないと全幅に広がって中央寄せの意味がなくなります。
- `VStack` 自体が既定で `align="center"`（子を中央揃え）なので、フォームの中身もそれぞれ中央揃えになっています（[10-stack-vstack-hstack.md](./10-stack-vstack-hstack.md)）。

## 今後に活かせるポイント

- 「ヘッダーは全幅、本文は Container で最大幅制限」は Web サイトの基本レイアウトです。
- 1つの要素を中央に置くだけなら、`Center` を使わず `mx="auto"` + `maxW` でも実現できます。

## 改善するなら

`Center` + `VStack maxW="xl" width="full"` は、`VStack` に `mx="auto"` を付けるだけでも同じ見た目になり、ネストを1段減らせます。

```tsx
<Container as="main" maxW="4xl" py={6}>
  <VStack as="form" maxW="xl" w="full" mx="auto" gap={4} onSubmit={handleSubmit}>
    ...
  </VStack>
</Container>
```

`Home.tsx` と `Input.tsx` で `<Header />` + `<Container as="main" maxW="4xl" py={6}>` が重複しているので、共通レイアウトコンポーネントにまとめるのも良い改善です。

```tsx
// components/Layout.tsx（例）
export const Layout = ({ children }: { children: ReactNode }) => (
  <>
    <Header />
    <Container as="main" maxW="4xl" py={6}>
      {children}
    </Container>
  </>
);
```

（React Router の `<Outlet />` を使ったレイアウトルートにする方法もあります。詳細は study/Routing を参照）

## 次に学ぶこと

- `AbsoluteCenter`（position: absolute での中央配置）
- `Square` / `Circle`（正方形・円形の中央寄せ箱）
