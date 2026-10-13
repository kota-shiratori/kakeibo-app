# デザイントークンとカラーパレット（teal.500, red.500, green.500, gray.500）

## 概要

Chakra UI には、色・余白・文字サイズなどの「デザインの値」に名前を付けた **デザイントークン** が用意されています。
色は `teal.500` のように **「色名.濃さ」** で指定します。濃さは `50`（最も薄い）〜 `950`（最も濃い）の段階です。

v3 ではさらに、ライト/ダークモードで値が切り替わる **セマンティックトークン**（`fg`, `bg`, `border`, `teal.solid` など）も用意されています。

## このプロジェクトでの実装

| 箇所 | 指定 | 用途 | 実際の色（`theme/tokens/colors.js` で確認） |
| --- | --- | --- | --- |
| `web-app/src/components/Header.tsx:7` | `bg="teal.500"` | ヘッダー背景 | `#14b8a6` |
| `web-app/src/components/TransactionList.tsx:91` | `color="red.500"` | エラーメッセージ | `#ef4444` |
| `web-app/src/components/TransactionList.tsx:165` | `"green.500"` / `"red.500"` | 収入/支出の金額 | `#22c55e` / `#ef4444` |
| `web-app/src/pages/Input.tsx:111` | `color="red.500"` | 登録エラー | `#ef4444` |
| `web-app/src/pages/Input.tsx:115` | `color="gray.500"` | キャンセルボタンの文字 | `#71717a` |

金額の色を条件で切り替えている部分:

`web-app/src/components/TransactionList.tsx:164-169`

```tsx
<Text
  color={transaction.amount > 0 ? "green.500" : "red.500"}
  fontWeight="bold"
>
  {transaction.amount.toLocaleString()}円
</Text>
```

トークン名は単なる文字列なので、三項演算子で切り替えられます。

### teal パレットの全段階（`dist/esm/theme/tokens/colors.js`）

```js
teal: {
  50:  { value: "#f0fdfa" },
  100: { value: "#ccfbf1" },
  // ...
  500: { value: "#14b8a6" },
  600: { value: "#0d9488" },
  // ...
  950: { value: "#021716" }
}
```

用意されている色: `gray`, `red`, `orange`, `yellow`, `green`, `teal`, `blue`, `cyan`, `purple`, `pink`, および `blackAlpha` / `whiteAlpha`、`black` / `white` など。

### セマンティックトークン（`dist/esm/theme/semantic-tokens/colors.js`）

各パレットには用途別の名前も定義されています。teal の例:

| セマンティックトークン | ライト | ダーク | 主な用途 |
| --- | --- | --- | --- |
| `teal.solid` | teal.600 | teal.600 | 塗りつぶしボタンの背景 |
| `teal.contrast` | white | white | solid の上に載る文字色 |
| `teal.fg` | teal.700 | teal.300 | 文字色 |
| `teal.subtle` | teal.100 | teal.900 | 薄い背景 |
| `teal.muted` | teal.200 | teal.800 | ホバー時の背景など |
| `teal.focusRing` | teal.500 | teal.500 | フォーカスリング |

全体共通のものとして `bg`（背景: ライト white / ダーク black）、`fg`（文字: ライト black / ダーク gray.50）、`border`、`fg.error`（ライト red.500）なども定義されています。

## 重要語句

| 語句 | 意味 |
| --- | --- |
| デザイントークン | デザインの値に付けた名前。`teal.500` など |
| カラーパレット | 1つの色相の濃淡セット（50〜950） |
| セマンティックトークン | 「何に使うか」で名付けたトークン。モードで値が変わる（`fg`, `bg.panel`, `teal.solid`） |
| `colorPalette` | コンポーネントに「どのパレットを使うか」を伝える props（[18-button.md](./18-button.md) 参照） |

## 仕様・注意点

- **v3 の `teal.500` は Tailwind CSS の色に近い値**です（例: `#14b8a6`）。v2 の teal.500 とは値が異なるので、v2 のスクリーンショットと色味が違っても正常です。
- ライト/ダークで切り替わるのはセマンティックトークンだけです。`teal.500` や `red.500` のような生のトークンはダークモードでも同じ色のままです。
- `color="gray.500"` を指定した要素は、ダークモードでも `#71717a` のまま。背景が黒になると読みにくくなる可能性があります。
- 存在しないトークン名（例: `"teel.500"`）を指定してもエラーにはならず、そのまま無効な CSS 値として出力されるだけです。

## 今後に活かせるポイント

- 意味のある色（エラー=赤、成功=緑）は、生のトークンより **セマンティックトークン**（`fg.error`, `fg.success`）を使うと、ダークモード対応やテーマ変更に強くなります。
- 色を直接書く代わりに「パレット + 用途」で考える習慣は、どのデザインシステムでも役立ちます。

## 改善するなら

1. **エラー表示・金額色をセマンティックトークンに**

```tsx
// エラー
<Text color="fg.error">{error.message}</Text>

// 金額（fg.success はライト green.600 / ダーク green.300）
<Text color={transaction.amount > 0 ? "fg.success" : "fg.error"} fontWeight="bold">
```

2. **ヘッダーのコントラスト**: `teal.500`（#14b8a6）の上に白文字は、WCAG が推奨するコントラスト比 4.5:1 を下回ります（約 2.5:1）。`teal.700` などの濃い色にすると読みやすくなります。

```tsx
<Box as="header" bg="teal.700" color="white" ...>
```

3. **色だけで意味を伝えない**: 収入/支出を色だけで区別すると色覚特性によっては判別しにくいので、`+` 記号やラベルを併用するとより親切です。

## 次に学ぶこと

- `createSystem` で独自のブランドカラー（`brand.50`〜`brand.950`）とセマンティックトークンを定義する
- カラーモード（ダークモード）対応
