# Chakra UI v3 + react-icons 学習ノート

家計簿アプリ（kakeibo-app）の `web-app/` で使っている **Chakra UI v3（@chakra-ui/react 3.37.0）** と **react-icons（5.7.0）** について、実際のコードをもとにまとめた学習ノートです。

- 内容は `web-app/node_modules/@chakra-ui/react` の型定義（`.d.ts`）・実装・テーマ定義を確認して書いています。
- React の state やフォーム送信ロジックは `study/React`、ルーティングは `study/Routing` を参照してください。

## 目次（学習順）

### 1. 土台（セットアップとスタイルの仕組み）

| # | ノート | 内容 |
| --- | --- | --- |
| 01 | [ChakraProvider と defaultSystem](./01-chakra-provider-and-system.md) | v3 の system / createSystem の考え方、v2 の theme / extendTheme との違い |
| 02 | [emotion への依存と CSS の生成](./02-emotion-dependency-and-css-layers.md) | なぜ @emotion/react が必要か、CSS 変数と CSS レイヤー |
| 03 | [スタイル props](./03-style-props.md) | bg, color, py, fontSize などと CSS の対応表 |
| 04 | [スペーシングスケールとサイズ](./04-spacing-and-size-scale.md) | py={4} = 16px、maxW="4xl" = 896px などトークン値一覧 |
| 05 | [カラートークンとパレット](./05-color-tokens-and-palette.md) | teal.500 などの実際の色、セマンティックトークン |
| 06 | [as prop とセマンティック HTML](./06-as-prop-and-semantic-html.md) | Box as="header" / Container as="main" / VStack as="form"、asChild |

### 2. レイアウト部品

| # | ノート | 内容 |
| --- | --- | --- |
| 07 | [Box と Flex](./07-box-and-flex.md) | 基本の箱と横並び（justifyContent / alignItems） |
| 08 | [Grid と GridItem](./08-grid-and-griditem.md) | templateColumns と colSpan、レスポンシブ化 |
| 09 | [Container と Center](./09-container-and-center.md) | 最大幅 + 中央寄せ、Container レシピの既定値 |
| 10 | [Stack / VStack / HStack](./10-stack-vstack-hstack.md) | gap と separator、VStack の align="center" |
| 11 | [Separator](./11-separator.md) | v2 の Divider からの改名、size / variant |

### 3. 表示部品

| # | ノート | 内容 |
| --- | --- | --- |
| 12 | [Text と Heading](./12-text-and-heading.md) | p / h2 の描画、size と見出しレベルの違い |
| 13 | [複合コンポーネントパターン](./13-compound-components.md) | X.Root / X.Item の仕組み（Context・スロットレシピ・Ark UI） |
| 14 | [Card](./14-card.md) | Card.Root / Header / Body、variant="elevated" |

### 4. フォーム部品

| # | ノート | 内容 |
| --- | --- | --- |
| 15 | [Field](./15-field.md) | Field.Root required の伝わり方、RequiredIndicator / ErrorText |
| 16 | [Input](./16-input.md) | type="number" / "date"、input レシピ |
| 17 | [RadioGroup](./17-radio-group.md) | 各パーツの役割、onValueChange の e.value、制御化 |
| 18 | [Button](./18-button.md) | colorPalette / variant / loading / type（既定は "button"） |
| 19 | [Spinner](./19-spinner.md) | 読み込み中表示の仕組みとアクセシビリティ |

### 5. アイコンとまとめ

| # | ノート | 内容 |
| --- | --- | --- |
| 20 | [react-icons](./20-react-icons.md) | FaPlus の使い方、Button 内でのサイズ・間隔の決まり方 |
| 21 | [v2 → v3 の主な変更点](./21-v2-to-v3-changes.md) | 確認できた変更点の対応表と見分け方 |

## 特に押さえておきたいポイント

1. v3 では `<ChakraProvider value={defaultSystem}>` が必須（01）
2. `py={4}` は 1rem = 16px。基本は「数値 × 4px」（04）
3. Chakra の `Button` は既定で `type="button"`。フォーム送信には `type="submit"` が必要（18）
4. `Field.Root required` だけでは `*` は出ない。`Field.RequiredIndicator` を置く（15）
5. `RadioGroup.Root` の `onValueChange` の引数は `{ value }`。`e.value` で取り出す（17）
6. ネットの情報が v2 か v3 かを見分ける（21）
