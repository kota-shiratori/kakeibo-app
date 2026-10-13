# ChakraProvider と defaultSystem（v3 の「system」という考え方）

## 概要

Chakra UI のコンポーネント（`Box` や `Button` など）は、アプリ全体を `<ChakraProvider>` で包んで初めて正しく動きます。
v3 では Provider に **`value={system}`** を渡すのが必須で、この `system` には「デザイントークン（色・余白・文字サイズなど）」「レシピ（各コンポーネントの見た目の定義）」「グローバル CSS」などがすべて詰まっています。

Chakra が用意している既定の system が **`defaultSystem`** です。このプロジェクトはカスタマイズせず `defaultSystem` をそのまま使っています。

## このプロジェクトでの実装

`web-app/src/main.tsx:4`

```tsx
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
```

`web-app/src/main.tsx:6-12`

```tsx
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ChakraProvider value={defaultSystem}>
      <App />
    </ChakraProvider>
  </StrictMode>,
);
```

- `<App />`（ルーティングを含むアプリ全体）を `ChakraProvider` で包んでいます。
- これにより、`App` 配下のすべてのコンポーネントで `bg="teal.500"` や `py={4}` のようなトークン指定が使えるようになります。

### Provider の型と中身（node_modules で確認）

`node_modules/@chakra-ui/react/dist/types/styled-system/provider.d.ts`

```ts
export interface ChakraProviderProps {
    value: SystemContext;      // ← 必須（? が付いていない）
    children: React.ReactNode;
}
```

実装（`dist/esm/styled-system/provider.js`）はとてもシンプルで、次の3つをしているだけです。

1. React Context に system を流す（`useChakraContext()` で取り出せる）
2. emotion の `<Global>` で CSS レイヤー宣言（`@layer ...`）を出力
3. emotion の `<Global>` でグローバル CSS（リセット CSS・CSS 変数など）を出力

### defaultSystem の正体

`dist/esm/preset.js`

```js
const defaultConfig = mergeConfigs(defaultBaseConfig, defaultThemeConfig);
const defaultSystem = createSystem(defaultConfig);
```

つまり `defaultSystem` は「Chakra 標準の設定（`defaultConfig`）を `createSystem()` に通して作ったもの」です。
`defaultThemeConfig`（`dist/esm/theme/index.js`）には次のような設定が入っています。

```js
const defaultThemeConfig = defineConfig({
  preflight: true,              // リセット CSS を有効にする
  cssVarsPrefix: "chakra",      // CSS 変数名の接頭辞（--chakra-colors-teal-500 など）
  cssVarsRoot: ":where(html, .chakra-theme)",
  globalCss,
  theme: { breakpoints, keyframes, tokens, semanticTokens, recipes, slotRecipes, textStyles, layerStyles, animationStyles }
});
```

## 重要語句

| 語句 | 意味 |
| --- | --- |
| Provider | React Context の値をツリー全体に配るコンポーネント |
| system（SystemContext） | トークン・レシピ・グローバル CSS などをまとめた「スタイルエンジン」 |
| `defaultSystem` | Chakra 標準設定から作られた system。そのまま使える |
| `createSystem(...configs)` | 設定（config）から system を作る関数。複数の config を渡せる |
| `defaultConfig` | Chakra 標準の設定オブジェクト。カスタマイズの土台になる |
| `defineConfig` | config を型安全に書くためのヘルパー（中身はそのまま返すだけ） |
| preflight | ブラウザ標準スタイルを打ち消すリセット CSS |

## 仕様・注意点

- **`value` は必須**。`<ChakraProvider>` だけ書くと型エラーになります（v2 は `theme` を省略できた）。
- **v2 との違い**: v2 では `extendTheme()` でテーマオブジェクトを作り `<ChakraProvider theme={theme}>` に渡していました。v3 ではこのプロジェクトの `node_modules` を検索しても `extendTheme` は存在せず、代わりに `createSystem` / `defineConfig` / `defaultConfig` が提供されています。
- v3 では Provider がカラーモード（ライト/ダーク）の管理をしません。`useColorMode` や `ColorModeProvider` は v3 のパッケージには含まれていません（型定義を検索して確認）。ダークモードは `html` 要素に `dark` クラスを付けると切り替わる仕組みです（`preset-base.js` の条件 `dark: ".dark &, ..."`）。
- `preflight: true` のため、`h1` や `p` の既定マージンなどはリセットされます。素の HTML と見た目が違うのはこのためです。

## 今後に活かせるポイント

- 「ライブラリのルートで Provider を1回だけ置く」構成は、React Router や TanStack Query など多くのライブラリで共通のパターンです。
- `useChakraContext()` で system を取り出せるので、トークン値を JS 側で使いたいときに役立ちます。

## 改善するなら

ブランドカラーやフォントを変えたくなったら、`defaultConfig` をベースに自分の config を重ねます。

```tsx
// web-app/src/theme.ts（例）
import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react";

const config = defineConfig({
  theme: {
    tokens: {
      colors: {
        brand: {
          500: { value: "#0d9488" },
        },
      },
    },
  },
});

export const system = createSystem(defaultConfig, config);
```

```tsx
// main.tsx
import { system } from "./theme";
<ChakraProvider value={system}>
```

公式 CLI の snippet（`npx @chakra-ui/cli snippet add`）を使うと、カラーモード対応の `Provider` コンポーネント（`components/ui/provider.tsx`）が生成され、それを使う構成も一般的です。

## 次に学ぶこと

- `createSystem` + `defineConfig` によるテーマのカスタマイズ（tokens / semanticTokens / recipes の上書き）
- カラーモード（`next-themes` と組み合わせた snippet の Provider）
- Chakra CLI の `typegen`（カスタムトークンの型生成）
