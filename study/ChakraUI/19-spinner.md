# Spinner（読み込み中の表示）

## 概要

`Spinner` は「読み込み中」を表すくるくる回る円のアイコンです。データ取得中など、待ち時間があることをユーザーに伝えるために使います。

## このプロジェクトでの実装

`web-app/src/components/TransactionList.tsx:84-87`

```tsx
// 読み込み中はスピナーを表示する。
if (isLoading) {
  return <Spinner />;
}
```

カスタムフックから受け取った `isLoading` が true の間、取引一覧の代わりにスピナーを表示しています（早期 return によるローディング表示）。

### 型とレシピ（node_modules で確認）

`dist/types/components/spinner/spinner.d.ts`

```ts
export interface SpinnerProps extends HTMLChakraProps<"span">, UnstyledProp, RecipeProps<"spinner"> {}
```

→ `<span>` として描画されます。

`dist/esm/theme/recipes/spinner.js`（抜粋）

```js
base: {
  display: "inline-block",
  borderColor: "currentColor",          // 文字色（color）と同じ色になる
  borderStyle: "solid",
  borderWidth: "2px",
  borderRadius: "full",
  width: "var(--spinner-size)",
  height: "var(--spinner-size)",
  animation: "spin",
  animationDuration: "slowest",
  "--spinner-track-color": "transparent",
  borderBottomColor: "var(--spinner-track-color)",
  borderInlineStartColor: "var(--spinner-track-color)"
},
variants: {
  size: {
    inherit: { "--spinner-size": "1em" },
    xs: { "--spinner-size": "sizes.3" },   // 12px
    sm: { "--spinner-size": "sizes.4" },   // 16px
    md: { "--spinner-size": "sizes.5" },   // 20px
    lg: { "--spinner-size": "sizes.8" },   // 32px
    xl: { "--spinner-size": "sizes.10" }   // 40px
  }
},
defaultVariants: { size: "md" }
```

- 正体は「4辺のうち2辺だけ色が付いた円形の枠線」を CSS アニメーションで回転させたものです。
- 色は `currentColor`（親から継承した文字色）。色を変えたいときは `color="teal.500"` を指定します。
- 既定サイズは `md`（20px）。

## 重要語句

| 語句 | 意味 |
| --- | --- |
| `currentColor` | その要素の `color` の値を参照する CSS キーワード |
| `--spinner-track-color` | 回っていない部分（トラック）の色。既定は透明 |
| 早期 return | 条件に当てはまったら先に return して、以降の描画をスキップする書き方 |

## 仕様・注意点

- スピナーだけでは、スクリーンリーダー利用者に「読み込み中」であることが伝わりにくい場合があります。視覚的に隠したテキストや `aria-label` などを併用すると親切です。
- 読み込みが一瞬で終わる場合、スピナーが一瞬だけ表示されてチラつくことがあります。
- **v2 との違い**: v2 の Spinner は `thickness` / `speed` / `emptyColor` などの専用 props を持っていましたが、v3 のレシピは CSS 変数（`--spinner-track-color` など）とスタイル props（`borderWidth`, `animationDuration`）で調整する設計です。v3 の型定義（上記）に専用 props はありません。

## 今後に活かせるポイント

- 「ローディング → エラー → 空 → データあり」の4状態を順に分岐する書き方（`TransactionList.tsx:85-108`）は、データ取得 UI の定番パターンです。
- 枠線 + 回転アニメーションでスピナーを作る CSS テクニックは、ライブラリなしでも応用できます。

## 改善するなら

1. テキストを添えてスクリーンリーダーにも伝える。

```tsx
import { HStack, Spinner, Text } from "@chakra-ui/react";

if (isLoading) {
  return (
    <HStack>
      <Spinner size="sm" color="teal.500" />
      <Text color="fg.muted">読み込み中...</Text>
    </HStack>
  );
}
```

2. カードの中身の形を保ったまま待たせたい場合は、`Skeleton` を使うとレイアウトのガタつきが減ります。

```tsx
import { Skeleton, Stack } from "@chakra-ui/react";

<Stack gap={3}>
  <Skeleton height="10" />
  <Skeleton height="10" />
  <Skeleton height="10" />
</Stack>
```

## 次に学ぶこと

- `Skeleton` / `SkeletonText`（プレースホルダー表示）
- `Loader` / `AbsoluteCenter` を使ったオーバーレイ表示
- `ProgressCircle` / `Progress`（進捗の表示）
