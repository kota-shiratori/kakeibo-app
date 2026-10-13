# react-icons の使い方と Button 内アイコン（FaPlus）

## 概要

**react-icons** は、Font Awesome・Material Design・Heroicons など多数のアイコンセットを React コンポーネントとして使えるライブラリです（このプロジェクトは v5.7.0）。
アイコンは `<svg>` として描画されるので、文字色やサイズを CSS で自由に変えられます。

v3 の Chakra UI では、ボタンにアイコンを付けるとき **アイコンを子要素として直接書く** のが基本です。

## このプロジェクトでの実装

`web-app/src/pages/Home.tsx:11`

```tsx
import { FaPlus } from "react-icons/fa";
```

`web-app/src/pages/Home.tsx:28-35`

```tsx
<Button
  colorPalette="teal"
  fontWeight="bold"
  onClick={() => navigate("/input")}
>
  <FaPlus />
  登録
</Button>
```

### import パスの意味

`react-icons/<アイコンセットの略称>` から import します。`node_modules/react-icons/` 内のディレクトリが各セットに対応しています。

| パス | アイコンセット | 名前の接頭辞 |
| --- | --- | --- |
| `react-icons/fa` | Font Awesome 5 | `Fa` |
| `react-icons/fa6` | Font Awesome 6 | `Fa` |
| `react-icons/md` | Material Design icons | `Md` |
| `react-icons/lu` | Lucide | `Lu` |
| `react-icons/hi2` | Heroicons 2 | `Hi` |

`FaPlus` は `react-icons/fa/index.d.ts:798` で `export declare const FaPlus: IconType;` と宣言されています。
必要なアイコンだけを名前付き import するので、ビルド時に使っていないアイコンは取り除かれます（tree shaking）。

### アイコンの型と描画（node_modules で確認）

`react-icons/lib/iconBase.d.ts`

```ts
export interface IconBaseProps extends React.SVGAttributes<SVGElement> {
    children?: React.ReactNode;
    size?: string | number;
    color?: string;
    title?: string;
}
export type IconType = (props: IconBaseProps) => React.ReactNode;
```

`react-icons/lib/iconBase.mjs`（抜粋）

```js
var computedSize = size || conf.size || "1em";
return React.createElement("svg", {
  stroke: "currentColor",
  fill: "currentColor",
  strokeWidth: "0",
  ...,
  height: computedSize,   // SVG の属性として width/height を指定
  width: computedSize,
});
```

- 既定サイズは **`1em`**（周りの文字サイズと同じ）、色は **`currentColor`**（周りの文字色と同じ）。
- そのため、ボタン内に置くと自動でボタンの文字色（solid の teal なら white）になります。

### Button 内でアイコンのサイズと間隔が整う仕組み

Button レシピ（`dist/esm/theme/recipes/button.js`）の `size: md`:

```js
md: { h: "10", minW: "10", textStyle: "sm", px: "4", gap: "2", _icon: { width: "5", height: "5" } }
```

- `gap: "2"` → アイコンとテキストの間に 0.5rem（8px）の間隔
- `_icon` は `& :where(svg)`（`preset-base.js` の条件定義）→ ボタン内の svg を `width/height: 1.25rem`（20px）にする

react-icons の `width`/`height` は **SVG の属性（presentation attribute）** として付いているため、CSS で指定された Chakra のサイズが優先されます。結果として、アイコンは 20px で表示されます。

## 重要語句

| 語句 | 意味 |
| --- | --- |
| アイコンセット | Font Awesome などのアイコン集。react-icons はそれらをまとめて提供 |
| `IconType` | react-icons の各アイコンコンポーネントの型 |
| `currentColor` | 親要素の文字色を使う CSS キーワード |
| `1em` | 現在のフォントサイズと同じ大きさ |
| tree shaking | 使われていないコードをビルド時に削除する最適化 |
| `_icon` | Chakra の条件 props。要素内の svg（`& :where(svg)`）にスタイルを当てる |

## 仕様・注意点

- **v2 との違い**: v2 の Button には `leftIcon` / `rightIcon` props があり、`<Button leftIcon={<FaPlus />}>` と書いていました。v3 の Button 型定義には `leftIcon` がなく、**子要素としてアイコンを並べる** 形になりました。右側に置きたければテキストの後ろに書くだけです。
- v2 には公式アイコンパッケージ `@chakra-ui/icons` がありましたが、v3 では react-icons や lucide-react などの外部アイコンライブラリを使うのが一般的です（このプロジェクトでもそうしています）。
- アイコンは装飾目的なら問題ありませんが、**アイコンだけのボタン** にする場合は、何のボタンかを伝える `aria-label` が必要です（`IconButton` を使う）。
- `react-icons/fa` と `react-icons/fa6` ではアイコンのデザインや名前が少し違います。混在させるとデザインの統一感がなくなるので、1つに揃えるのがおすすめです。
- Chakra の `Icon` コンポーネントでラップすると、`<Icon as={FaPlus} color="teal.500" boxSize={5} />` のように Chakra のトークンでサイズや色を指定できます。

## 今後に活かせるポイント

- 「SVG アイコンは `currentColor` + `1em`」という設計を知っておくと、どのアイコンライブラリでも色とサイズの調整に迷いません。
- ボタンの「アイコン + テキスト」は、テキストだけより操作の意味が伝わりやすくなります（今回の「＋ 登録」）。

## 改善するなら

1. 装飾目的のアイコンは、スクリーンリーダーに読ませないよう `aria-hidden` を付けると丁寧です。

```tsx
<Button colorPalette="teal" fontWeight="bold">
  <FaPlus aria-hidden />
  登録
</Button>
```

2. ボタン以外の場所でトークンを使って色・サイズを指定したい場合は Chakra の `Icon` で包みます。

```tsx
import { Icon } from "@chakra-ui/react";
import { FaArrowUp } from "react-icons/fa";

<Icon as={FaArrowUp} color="fg.success" boxSize={4} />
```

## 次に学ぶこと

- `IconButton`（アイコンのみのボタン）
- Chakra の `Icon` / `createIcon`（自作 SVG アイコンの作成）
- lucide-react など他のアイコンライブラリとの比較
