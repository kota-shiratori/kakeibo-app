# スタイル props（bg, color, py, fontSize など）と CSS の対応

## 概要

Chakra UI では、CSS を別ファイルに書く代わりに **コンポーネントの props として直接スタイルを書けます**。これを「スタイル props（style props）」と呼びます。
`bg="teal.500"` と書くと、Chakra が `background: var(--chakra-colors-teal-500)` という CSS を生成して適用してくれます。

## このプロジェクトでの実装

`web-app/src/components/Header.tsx:5-16`

```tsx
<Box
  as="header"
  bg="teal.500"
  color="white"
  py={4}
  textAlign="center"
  boxShadow="md"
>
  <Text fontSize="xl" fontWeight="bold">
    シンプル家計簿
  </Text>
</Box>
```

各 props が CSS の何に対応するかを、`node_modules/@chakra-ui/react/dist/esm/preset-base.js`（ユーティリティ定義）と `theme/tokens/*.js`（トークン値）で確認した結果が次の表です。

| props | CSS プロパティ | 参照するトークン | このコードでの実際の値 |
| --- | --- | --- | --- |
| `bg` | `background` | colors | `teal.500` = `#14b8a6` |
| `color` | `color` | colors | `white` |
| `py` | `padding-block`（上下の余白） | spacing | `4` = `1rem`（16px） |
| `textAlign` | `text-align` | なし | `center` |
| `boxShadow`（別名 `shadow`） | `box-shadow` | shadows | `md`（ライトモード時 `0px 4px 8px` の影 + 1px の輪郭影） |
| `fontSize` | `font-size` | fontSizes | `xl` = `1.25rem`（20px） |
| `fontWeight` | `font-weight` | fontWeights | `bold` = `700` |

ほかにもプロジェクト内で以下が使われています。

| 使用箇所 | props | 対応 CSS | 値 |
| --- | --- | --- | --- |
| `web-app/src/pages/Home.tsx:24` | `maxW="4xl"` | `max-width` | `56rem`（896px） |
| `web-app/src/pages/Input.tsx:59-60` | `maxW="xl"` / `width="full"` | `max-width` / `width` | `36rem`（576px） / `100%` |
| `web-app/src/pages/Input.tsx:112` | `width="sm"` / `mt={4}` | `width` / `margin-top` | `24rem`（384px） / `1rem` |
| `web-app/src/pages/Input.tsx:117` | `flex={1}` | `flex` | `1` |
| `web-app/src/components/TransactionList.tsx:151` | `justifyContent` / `alignItems` | 同名 CSS | `space-between` / `center` |

## 重要語句

| 語句 | 意味 |
| --- | --- |
| スタイル props | CSS プロパティを props として渡せる仕組み |
| ショートハンド | 短い別名。`bg`=background、`py`=paddingBlock（paddingY）、`mt`=marginTop、`maxW`=maxWidth、`w`=width |
| トークン参照 | `"teal.500"` や `4` のように、テーマに登録された値の名前で指定すること |
| 論理プロパティ | `padding-block` のように、縦書き/横書きに依存しない CSS プロパティ |

## 仕様・注意点

- **トークンにない値はそのまま CSS になります**。`py="13px"` や `bg="#ff0000"` も書けます。逆に言うと、`bg="teel.500"` のようなタイポをしても実行時エラーにはならず、ただ色が付かないだけなので注意（TypeScript の補完で候補が出るので活用しましょう）。
- `py` は `padding-top` + `padding-bottom` ではなく **`padding-block`** にマッピングされています（`preset-base.js` の `paddingBlock: { values: "spacing", shorthand: ["py", "paddingY"] }`）。横書きの日本語ページでは結果は同じです。
- `py={4}`（数値）と `py="4"`（文字列）はどちらもトークン `spacing.4` を参照します。
- `boxShadow="md"` の `md` は **セマンティックトークン** で、ライトモードとダークモードで値が切り替わります（`theme/semantic-tokens/shadows.js`）。
- `fontWeight="bold"` のように、レシピ（コンポーネント既定の見た目）が持つスタイルを props で上書きできます。例: `Button` の既定 `fontWeight` は `medium`（500）ですが、`fontWeight="bold"` で 700 になります。
- **レスポンシブ指定**: `py={{ base: 2, md: 4 }}` のようにオブジェクトで書くとブレークポイントごとの値になります（ブレークポイントは `sm: 480px, md: 768px, lg: 1024px, xl: 1280px, 2xl: 1536px`、`theme/breakpoints.js` で確認）。配列記法 `py={[2, 4]}` も使えます。
- 疑似クラスは `_hover={{ bg: "teal.600" }}` のように `_` から始まる props で書けます。

## 今後に活かせるポイント

- 「props 名 = CSS プロパティ名（キャメルケース）」が基本なので、CSS を知っていればほぼそのまま書けます。迷ったら CSS 名で書けば動きます。
- 値はトークンを使うと、余白や色がアプリ全体で統一されます。直値（`13px` など）は最小限に。

## 改善するなら

ヘッダーの文字サイズを画面幅に応じて変えると、スマホでも見やすくなります。

```tsx
<Text fontSize={{ base: "lg", md: "xl" }} fontWeight="bold">
  シンプル家計簿
</Text>
```

同じスタイルを何度も書く場合は、`textStyle`（テキストスタイル）や `layerStyle` を使うか、system のレシピで定義すると重複を減らせます。

## 次に学ぶこと

- `css` prop（オブジェクトでまとめてスタイルを書く方法）
- `textStyle` / `layerStyle` の活用
- 疑似クラス props（`_hover`, `_focus`, `_disabled`）と条件付きスタイル（`_dark` など）
