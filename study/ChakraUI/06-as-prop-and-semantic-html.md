# as prop によるタグ差し替えとセマンティック HTML

## 概要

Chakra のコンポーネントはそれぞれ既定の HTML タグで描画されます（`Box` → `div`、`Text` → `p`、`Heading` → `h2` など）。
**`as` prop** を使うと、見た目のスタイルはそのままに、出力される HTML タグだけを差し替えられます。
これにより、`<header>` `<main>` `<form>` などの **意味のあるタグ（セマンティック HTML）** を使いながら Chakra のスタイル props を活用できます。

## このプロジェクトでの実装

### ヘッダー: `Box as="header"`

`web-app/src/components/Header.tsx:5-12`

```tsx
<Box
  as="header"
  bg="teal.500"
  ...
>
```

→ 出力 HTML: `<header class="...">`

### メイン領域: `Container as="main"`

`web-app/src/pages/Home.tsx:24` / `web-app/src/pages/Input.tsx:56`

```tsx
<Container as="main" maxW="4xl" py={6}>
```

→ 出力 HTML: `<main class="chakra-container ...">`

### フォーム: `VStack as="form"`

`web-app/src/pages/Input.tsx:58-64`

```tsx
<VStack
  maxW="xl"
  width="full"
  gap={4}
  as="form"
  onSubmit={handleSubmit}
>
```

→ 出力 HTML: `<form class="chakra-stack ...">`。縦並びレイアウト（flex column）の機能を持ったまま、本物の `<form>` 要素になるので、`onSubmit` や Enter キーでの送信、`required` によるブラウザのバリデーションが働きます。

### 型定義での確認

`node_modules/@chakra-ui/react/dist/types/styled-system/factory.types.d.ts`

```ts
export interface PolymorphicProps {
    as?: ElementType | undefined;
    asChild?: boolean | undefined;
}
export type HTMLChakraProps<T extends ElementType, P extends Dict = {}> =
  JsxHtmlProps<ComponentPropsWithoutRef<T>, Assign<JsxStyleProps, P> & PolymorphicProps>;
```

すべての Chakra コンポーネントの props に `as` と `asChild` が含まれています。

## 重要語句

| 語句 | 意味 |
| --- | --- |
| `as` prop | 描画する HTML タグ（またはコンポーネント）を差し替える props |
| `asChild` prop | 自分自身は描画せず、子要素にスタイルと props を合成する（v3 の新機能） |
| セマンティック HTML | 意味を表すタグ（header, main, nav, form, section など）でページを組むこと |
| ランドマーク | スクリーンリーダーが「ここはヘッダー」「ここはメイン」と認識できる領域 |
| ポリモーフィック | 1つのコンポーネントが複数の要素型として振る舞えること |

## 仕様・注意点

- **型は既定タグのまま**: `VStack` の props 型は `HTMLChakraProps<"div", ...>` で固定されています。`as="form"` にしても TypeScript 上は `div` の props 扱いなので、`onSubmit` のイベント型は `FormEvent<HTMLDivElement>` になります。このプロジェクトの `handleSubmit(e: FormEvent)`（ジェネリクス省略 = `FormEvent<Element>`）はそれを受け取れるので問題ありませんが、`e.currentTarget` を `HTMLFormElement` として使いたい場合は注意が必要です。同様に、`form` 固有の属性（`action`, `noValidate` など）も型チェックが効きにくくなります。
- `as` に渡したタグにもスタイル props はそのまま効きます。
- **v2 との違い**: v2 でも `as` は使えましたが、v3 では `asChild` が追加されました。他のコンポーネント（例: React Router の `Link`）に Chakra のスタイルを付けたいときは、v3 では `asChild` を使うのが推奨されています。

```tsx
// asChild の例（Button の見た目で React Router の Link を描画）
import { Link } from "react-router";
<Button asChild colorPalette="teal">
  <Link to="/input">登録</Link>
</Button>
```

- ブラウザのフォームバリデーション（`required` など）は `<form>` の中でしか送信時に働きません。`as="form"` を外すと動かなくなります。

## 今後に活かせるポイント

- 1ページに `<main>` は1つ、ヘッダーは `<header>`、ナビは `<nav>` という基本を守ると、アクセシビリティと SEO の両方に効きます。
- 「見た目のためのコンポーネント」と「意味のためのタグ」を `as` で分離して考えるのは、Chakra 以外（styled-components、MUI の `component` prop など）でも共通の考え方です。

## 改善するなら

1. `Home.tsx` の「登録」ボタンは `navigate("/input")` でページ移動しています。ページ移動は本来リンク（`<a>`）の役割なので、`asChild` で `Link` にすると、右クリックで「新しいタブで開く」なども使えるようになります。

```tsx
import { Link } from "react-router";

<Button asChild colorPalette="teal" fontWeight="bold">
  <Link to="/input">
    <FaPlus />
    登録
  </Link>
</Button>
```

2. フォームの型を厳密にしたい場合は、`chakra.form` を使う方法もあります（`chakra` ファクトリは `@chakra-ui/react` から import 可能）。

```tsx
import { chakra } from "@chakra-ui/react";
<chakra.form display="flex" flexDirection="column" gap={4} onSubmit={handleSubmit}>
```

## 次に学ぶこと

- `asChild` パターンの詳細（Radix UI / Ark UI 由来の考え方）
- `chakra` ファクトリ（`chakra.form`, `chakra("button", { ... })`）
- HTML のランドマークとアクセシビリティ
