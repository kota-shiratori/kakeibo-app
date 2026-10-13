# Separator（v2 の Divider からの改名）

## 概要

`Separator` は区切り線を表示する部品です。v2 では `Divider` という名前でしたが、v3 で **`Separator`** に改名されました。
既定では横線（`orientation="horizontal"`）で、`size` で太さ、`variant` で線の種類（実線・破線・点線）を変えられます。

## このプロジェクトでの実装

`web-app/src/components/TransactionList.tsx:10`

```tsx
import { Box, Flex, Separator, Spinner, Stack, Text } from "@chakra-ui/react";
```

`web-app/src/components/TransactionList.tsx:123`

```tsx
<Stack separator={<Separator size="sm" />}>
```

`Stack` の `separator` に渡して、取引どうしの間に 1px の線を入れています。

### 型とレシピ（node_modules で確認）

`dist/types/components/separator/separator.d.ts`

```ts
export interface SeparatorProps extends HTMLChakraProps<"span", SeparatorBaseProps> {}
```

→ 描画されるタグは `<span>`（レシピで `display: block`）。

`dist/esm/theme/recipes/separator.js`（抜粋）

```js
base: { display: "block", borderColor: "border" },
variants: {
  variant: { solid: {...}, dashed: {...}, dotted: {...} },
  orientation: {
    vertical:   { borderInlineStartWidth: "var(--separator-thickness)" },
    horizontal: { borderTopWidth: "var(--separator-thickness)" }
  },
  size: {
    xs: { "--separator-thickness": "0.5px" },
    sm: { "--separator-thickness": "1px" },
    md: { "--separator-thickness": "2px" },
    lg: { "--separator-thickness": "3px" }
  }
},
defaultVariants: { size: "sm", variant: "solid", orientation: "horizontal" }
```

- `size="sm"` は既定値なので、このコードでは **書かなくても同じ結果** です（明示しているのは読みやすさのためと考えられます）。
- 線の色は `border` セマンティックトークン（ライト/ダークで自動切替）。

## 重要語句

| 語句 | 意味 |
| --- | --- |
| `Separator` | 区切り線の部品（v2 の `Divider`） |
| `orientation` | `horizontal`（横線）/ `vertical`（縦線） |
| `size` | 線の太さ（xs: 0.5px / sm: 1px / md: 2px / lg: 3px） |
| `variant` | `solid` / `dashed` / `dotted` |
| レシピ（recipe） | コンポーネントの既定スタイルとバリアントの定義 |

## 仕様・注意点

- **v2 との違い**: `Divider` は v3 には存在しません（型定義を検索して確認）。v2 のコードを移植するときは `Separator` に置き換えます。
- `Stack` の `separator` に渡した場合、Stack 側が `borderTopWidth: "1px"` などのスタイルを `css` として追加で合成します（`get-separator-style.js`）。そのため Stack 内では Stack の向きに合わせて線の向きが自動調整されます。
- 縦線（`orientation="vertical"`）にする場合、親要素に高さがないと線が見えません。

## 今後に活かせるポイント

- v2 → v3 では「意味をより正確に表す名前」への改名がいくつかあります（Divider → Separator、FormControl → Field など）。HTML/ARIA の用語（`role="separator"`）に寄せた命名です。
- レシピの `defaultVariants` を見れば「何も指定しないとどうなるか」がわかります。props を省略してよいかの判断材料になります。

## 改善するなら

既定値と同じ `size="sm"` は省略できます。また、カード内の一覧なので少し控えめにしたい場合は破線にするなどの調整ができます。

```tsx
<Stack separator={<Separator />}>                    {/* size="sm" は既定 */}
<Stack separator={<Separator variant="dashed" />}>   {/* 破線にする例 */}
```

## 次に学ぶこと

- `StackSeparator`（Stack 専用の区切り部品）
- 区切り線にラベルを付けるレイアウト（`HStack` + `Separator flex="1"` + `Text`）
