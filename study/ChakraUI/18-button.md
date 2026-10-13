# Button（colorPalette, variant, loading, type）

## 概要

`Button` はクリック可能なボタンの部品です。v3 では次の props が重要です。

| props | 意味 | 既定値 |
| --- | --- | --- |
| `colorPalette` | 使うカラーパレット（teal, red など） | `gray`（グローバル CSS で設定） |
| `variant` | 見た目の種類（solid / subtle / surface / outline / ghost / plain） | `solid` |
| `size` | 大きさ（2xs〜2xl） | `md` |
| `loading` | true でスピナー表示 + 押せなくなる | — |
| `type` | HTML の button type（button / submit / reset） | **`"button"`** |

## このプロジェクトでの実装

### Home の「登録」ボタン（ページ移動）

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

### Input の「キャンセル」ボタン

`web-app/src/pages/Input.tsx:113-122`

```tsx
<Button
  type="button"
  color="gray.500"
  variant="outline"
  flex={1}
  onClick={onCancel}
  fontWeight="bold"
>
  キャンセル
</Button>
```

### Input の「登録」ボタン（フォーム送信）

`web-app/src/pages/Input.tsx:123-131`

```tsx
<Button
  type="submit"
  colorPalette="teal"
  flex={1}
  fontWeight="bold"
  loading={isLoading}
>
  登録
</Button>
```

### 実装の確認（`dist/esm/components/button/button.js`）

```js
return jsx(chakra.button, {
  type: "button",          // ← 既定で type="button"
  ref,
  ...rest,                 // ← 利用者が渡した type などで上書きされる
  "data-loading": dataAttr(loading),
  disabled: loading || rest.disabled,   // ← loading 中は disabled
  children: !props.asChild && loading
    ? jsx(Loader, { spinner, text: loadingText, spinnerPlacement, children })
    : children
});
```

型定義（`dist/types/components/button/button.d.ts`）にある loading 関連の props:

```ts
loading?: boolean;                       // スピナーを表示
loadingText?: React.ReactNode;           // ローディング中に表示するテキスト
spinner?: React.ReactNode;               // スピナーの差し替え
spinnerPlacement?: "start" | "end";      // スピナーの位置
```

### レシピ（`dist/esm/theme/recipes/button.js` 抜粋）

```js
base: { display: "inline-flex", borderRadius: "l2", fontWeight: "medium", ... },
variants: {
  size: { md: { h: "10", minW: "10", textStyle: "sm", px: "4", gap: "2", _icon: { width: "5", height: "5" } }, ... },
  variant: {
    solid:   { bg: "colorPalette.solid", color: "colorPalette.contrast", _hover: { bg: "colorPalette.solid/90" } },
    outline: { borderWidth: "1px", borderColor: "...colorPalette.border...", color: "colorPalette.fg", _hover: { bg: "colorPalette.subtle" } },
    // subtle, surface, ghost, plain
  }
},
defaultVariants: { size: "md", variant: "solid" }
```

これを踏まえて、このプロジェクトのボタンの見た目は次のようになります。

| ボタン | 背景 | 文字色 | 備考 |
| --- | --- | --- | --- |
| Home「登録」 | `teal.solid` = teal.600（#0d9488） | `teal.contrast` = white | ホバーで 90% の不透明度 |
| Input「キャンセル」 | 透明 | `color="gray.500"` で上書き | 枠線は `gray.border`（ライト: gray.200） |
| Input「登録」 | teal.600 | white | 送信中はスピナー表示・押せない |

## 重要語句

| 語句 | 意味 |
| --- | --- |
| `colorPalette` | コンポーネント内の `colorPalette.solid` などの参照先パレットを切り替える props |
| 仮想カラー（`colorPalette.xxx`） | レシピ内で「どのパレットか未定」の状態で書かれた色。`colorPalette` props で実体が決まる |
| `variant` | 見た目の種類 |
| `loading` | 処理中の表示。自動で `disabled` になる |
| `type="submit"` | フォームを送信するボタン |

## 仕様・注意点

- **Chakra の Button は既定で `type="button"`** です（実装で確認）。HTML の `<button>` はフォーム内だと既定が `submit` ですが、Chakra の Button は違います。そのため、フォーム送信ボタンには **`type="submit"` が必須** です。このプロジェクトでは正しく指定されています（`Input.tsx:124`）。キャンセルボタンの `type="button"` は既定値と同じなので省略可能ですが、明示しておくと意図が読み取りやすくなります。
- **v2 との違い**:
  - `colorScheme="teal"` → **`colorPalette="teal"`**
  - `isLoading` → **`loading`**、`isDisabled` → **`disabled`**（`is` 接頭辞の廃止。v3 の型定義に `isLoading` は存在しない）
  - `leftIcon={<FaPlus />}` → **子要素としてアイコンを直接書く**（v3 の型定義に `leftIcon` は存在しない。[20-react-icons.md](./20-react-icons.md)）
- `colorPalette` は CSS 変数の仕組みで子孫にも継承されます。親の `Box` に `colorPalette="teal"` を付けると、中のボタンやラジオがまとめて teal になります。
- キャンセルボタンは `color="gray.500"` で文字色を上書きしていますが、枠線の色は `colorPalette`（gray）由来のまま、ホバー背景も `gray.subtle` です。`colorPalette="gray"` のまま `color` だけ変える形なので、ダークモードでは文字が読みにくくなる可能性があります。
- `loading` 中は `disabled` になるため、二重送信を防げます。

## 今後に活かせるポイント

- 「主要な操作は solid、補助的な操作は outline / ghost」というボタンの使い分けは、多くのデザインシステムで共通です。
- `colorPalette` の仕組み（仮想カラー）を理解すると、自作コンポーネントでも `colorPalette` に対応したスタイルを書けます（`bg="colorPalette.subtle"` など）。

## 改善するなら

1. **キャンセルボタンは variant だけで表現する**: `color` の直接指定をやめると、ダークモードでもトークンに沿った色になります。

```tsx
<Button variant="outline" flex={1} onClick={onCancel} fontWeight="bold">
  キャンセル
</Button>
```

2. **ローディング中のテキストを出す**

```tsx
<Button type="submit" colorPalette="teal" loading={isLoading} loadingText="登録中...">
  登録
</Button>
```

3. **`fontWeight="bold"` の重複**: 3つのボタンすべてに付いているので、テーマ（system）の button レシピで既定値を変えるか、`Button.PropsProvider` 相当の仕組み（`ButtonPropsProvider`）でまとめて指定する方法があります。

4. ページ移動のボタンは `asChild` + `Link` にする（[06-as-prop-and-semantic-html.md](./06-as-prop-and-semantic-html.md) 参照）。

## 次に学ぶこと

- `IconButton`（アイコンだけのボタン。`aria-label` 必須）
- `ButtonGroup` / `Group`（ボタンの連結）
- `CloseButton`
- `Toaster`（`createToaster`）で「登録しました」の通知を出す
