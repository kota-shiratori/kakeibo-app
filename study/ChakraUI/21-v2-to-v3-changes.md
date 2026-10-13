# Chakra UI v2 → v3 の主な変更点まとめ

## 概要

Chakra UI v3 は v2 から API が大きく変わりました。ネット上の記事や AI の回答には v2 の書き方が混ざっていることが多いので、**どちらのバージョンの情報かを見分けること** が重要です。

このノートでは、このプロジェクトの `node_modules/@chakra-ui/react`（v3.37.0）の型定義・実装を検索して **v3 側の事実を確認できたもの** をまとめます。v2 側の書き方は、v2 で一般的だった API です。

## このプロジェクトでの実装（v3 の書き方の対応表）

| テーマ | v2 の書き方 | v3 の書き方（このプロジェクト） | v3 側の確認方法 |
| --- | --- | --- | --- |
| Provider | `<ChakraProvider theme={theme}>`（省略可） | `<ChakraProvider value={defaultSystem}>`（`web-app/src/main.tsx:8`） | `provider.d.ts` で `value: SystemContext` が必須 |
| テーマ作成 | `extendTheme({...})` | `createSystem(defaultConfig, defineConfig({...}))` | 型定義に `extendTheme` なし、`createSystem` / `defineConfig` あり |
| 区切り線 | `<Divider />` | `<Separator />`（`web-app/src/components/TransactionList.tsx:123`） | 型定義に `Divider` なし |
| Stack の間隔 | `spacing={4}` | `gap={4}`（`web-app/src/pages/Input.tsx:61`） | `StackOptions` に `spacing` なし。実装は `gap = "0.5rem"` |
| Stack の区切り | `divider={<Divider />}` | `separator={<Separator />}` | `StackOptions.separator` |
| 色の指定 | `colorScheme="teal"` | `colorPalette="teal"`（`web-app/src/pages/Home.tsx:29`） | Button レシピが `colorPalette.solid` などを参照 |
| ローディング | `isLoading` | `loading`（`web-app/src/pages/Input.tsx:128`） | `button.d.ts` に `loading` あり、`isLoading` なし |
| 真偽値 props | `isDisabled` / `isRequired` / `isInvalid` | `disabled` / `required` / `invalid` | 型定義に `is〜` 系なし |
| ボタンのアイコン | `leftIcon={<FaPlus />}` | 子要素に `<FaPlus />`（`web-app/src/pages/Home.tsx:33`） | 型定義に `leftIcon` なし |
| カード | `<Card><CardHeader><CardBody>` | `<Card.Root><Card.Header><Card.Body>`（`web-app/src/pages/Home.tsx:61-66`） | `export * as Card from "./namespace"` |
| フォーム項目 | `<FormControl isRequired><FormLabel>` | `<Field.Root required><Field.Label>`（`web-app/src/pages/Input.tsx:84-85`） | 型定義に `FormControl` なし |
| 必須マーク | `FormLabel` が自動表示 | `<Field.RequiredIndicator />` を明示 | `FieldRequiredIndicator` の実装 |
| ラジオ | `<RadioGroup onChange={(v) => ...}><Radio value>` | `<RadioGroup.Root onValueChange={(e) => e.value}><RadioGroup.Item>`（`web-app/src/pages/Input.tsx:65-83`） | Zag.js の `ValueChangeDetails { value: string \| null }` |
| タグ差し替え | `as` | `as` に加え `asChild` | `PolymorphicProps { as?; asChild? }` |
| 複数行省略 | `noOfLines` | `lineClamp`（スタイル props） | `system.gen.d.ts` に `lineClamp` |
| カラーモード | `useColorMode` / `ColorModeScript` | パッケージに含まれない（`.dark` クラスで切替。snippet + next-themes が一般的） | 型定義に `useColorMode` / `ColorModeProvider` なし |
| トースト | `useToast()` | `createToaster()` + `<Toaster />` | `toast/index.d.ts` に `createToaster`, `Toaster`。`useToast` なし |
| モーダル | `Modal` | `Dialog`（複合コンポーネント） | `components/dialog` が存在 |
| 依存パッケージ | `@emotion/react` + `@emotion/styled` + `framer-motion` | `@emotion/react` のみ（peer） | `package.json` の peerDependencies / dependencies |

## 重要語句

| 語句 | 意味 |
| --- | --- |
| system | v3 のテーマ + スタイルエンジン（v2 の theme に相当） |
| 複合コンポーネント | `X.Root` / `X.Item` のようにパーツを組み合わせる v3 の基本形 |
| Ark UI | v3 の内部で状態管理・アクセシビリティを担当するヘッドレス UI ライブラリ |
| `colorPalette` | v2 の `colorScheme` の後継。CSS 変数として子孫にも継承される |
| snippets | Chakra CLI で生成できる、よく使うラッパーコンポーネント集（v3 で導入） |

## 仕様・注意点

- **見分け方のコツ**: `Card.Root` のような「ドット区切り」、`colorPalette`、`loading`（`is` なし）、`value={system}` が出てきたら v3。`colorScheme`、`isLoading`、`extendTheme`、`Divider`、`FormControl` が出てきたら v2 です。
- **トークンの値も変わっています**。例えば v3 の `teal.500` は `#14b8a6`、Container の既定 `maxWidth` は `8xl`（90rem）、Card の既定 variant は `outline` など。v2 の記事のスクリーンショットと見た目が違っても、v3 として正常な場合があります。
- **コールバックの引数形式**: v3 の Ark UI ベースの部品は、`onValueChange` / `onCheckedChange` / `onOpenChange` のように「details オブジェクト」を受け取る形が多いです。`e.value` / `e.checked` / `e.open` のように取り出します。
- **移行のコツ**: v2 のコードを v3 に移すときは、TypeScript の型エラーを手がかりに1つずつ直すのが確実です（上の表の v2 の props の多く（`isLoading`, `spacing`, `divider`, `leftIcon`, `noOfLines`, `isRequired` など）は v3 の型に存在しないため、エラーとして検出されます）。ただし **`colorScheme` は例外** で、v3 では CSS の `color-scheme` プロパティのスタイル props として型に存在するため、`<Button colorScheme="teal">` は型エラーにならず、色も変わりません（scratchpad で `tsc` を実行して確認）。`colorScheme` は検索して手で `colorPalette` に置き換えましょう。

## 今後に活かせるポイント

- 調べものをするときは「chakra ui v3」とバージョンを付けて検索し、公式ドキュメント（chakra-ui.com）のバージョン表記を確認する。
- 迷ったら **`node_modules/@chakra-ui/react/dist/types/` の型定義を直接見る** のが最も確実です。このノート群もその方法で確認しています。エディタで「定義へ移動（F12）」を使えば簡単に辿れます。

## 改善するなら

このプロジェクトはすでに v3 の書き方で統一されていて、v2 の API は混ざっていません。今後コードを追加するときも、上の対応表の右列の書き方を守りましょう。

v3 らしさをさらに活かすなら:

```tsx
// 1. Field.RequiredIndicator / Field.ErrorText を使う
<Field.Root required invalid={amountInvalid}>
  <Field.Label>金額 <Field.RequiredIndicator /></Field.Label>
  <Input ... />
  <Field.ErrorText>1円以上を入力してください</Field.ErrorText>
</Field.Root>

// 2. RadioGroup を制御コンポーネントにし、colorPalette を揃える
<RadioGroup.Root value={transactionType} onValueChange={...} colorPalette="teal">

// 3. 登録成功時に Toaster で通知（snippet の toaster を使うのが簡単）
```

## 次に学ぶこと

- Chakra CLI（`npx @chakra-ui/cli snippet add` / `typegen`）
- `createSystem` によるテーマカスタマイズとカラーモード対応
- `Dialog`（削除確認など）、`Toaster`（登録完了通知）、`Menu`、`Tabs` などの複合コンポーネント
