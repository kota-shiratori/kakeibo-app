# emotion への依存と CSS の生成のされ方

## 概要

Chakra UI v3 は、`bg="teal.500"` のような props を **実行時に CSS に変換してページに挿入** します（CSS-in-JS）。その挿入処理に使っているのが **emotion**（`@emotion/react`）です。
そのため `package.json` には Chakra 本体と一緒に `@emotion/react` が入っています。

## このプロジェクトでの実装

`web-app/package.json`（dependencies 抜粋）

```json
"@chakra-ui/react": "^3.37.0",
"@emotion/react": "^11.14.0",
```

Chakra 側の `package.json`（`node_modules/@chakra-ui/react/package.json`）を見ると、emotion は **peerDependencies** に指定されています。

```json
"peerDependencies": {
  "@emotion/react": ">=11",
  "react": ">=18",
  "react-dom": ">=18"
}
```

peerDependency は「このライブラリを使う側（アプリ）が自分でインストールしてね」という意味です。だからアプリの `package.json` に `@emotion/react` を書く必要があります。

`ChakraProvider` の実装（`dist/esm/styled-system/provider.js`）では、emotion の `Global` を使ってグローバル CSS を出力しています。

```js
import { Global } from '@emotion/react';
// ...
!sys._config.disableLayers && <Global styles={sys.layers.atRule} />,
<Global styles={sys._global} />,
```

## 重要語句

| 語句 | 意味 |
| --- | --- |
| CSS-in-JS | JavaScript の中でスタイルを書き、実行時に CSS を生成する手法 |
| emotion | 代表的な CSS-in-JS ライブラリ。Chakra が内部で使用 |
| peerDependencies | 「利用者側でインストールしてほしい」依存関係 |
| CSS 変数（カスタムプロパティ） | `--chakra-colors-teal-500` のような変数。トークンはこれに変換される |
| CSS カスケードレイヤー（`@layer`） | CSS の優先順位をグループ単位で制御する仕組み |

## 仕様・注意点

- **v2 との違い**: v2 では `@emotion/react`・`@emotion/styled`・`framer-motion` の3つを一緒に入れる必要がありました。v3 の peerDependencies は `@emotion/react` だけで、`dependencies` にも `framer-motion` は含まれていません（このプロジェクトの `node_modules/@chakra-ui/react/package.json` で確認）。アニメーションは CSS アニメーション（`animation: "spin"` など）で行われます。
- トークンは CSS 変数になります。例えば `teal.500` は `var(--chakra-colors-teal-500)` として参照されます（接頭辞 `chakra` は `cssVarsPrefix` の設定値）。ブラウザの開発者ツールで要素を調べると確認できます。
- v3 は CSS カスケードレイヤー（`@layer`）を使ってリセット・トークン・レシピなどの優先順位を整理しています（`disableLayers` を設定しなければ有効）。自作 CSS を混ぜるとき、レイヤー外の CSS はレイヤー内の CSS より優先される点に注意。
- 実行時に CSS を生成するため、React Server Components（サーバー側だけで動くコンポーネント）では Chakra のコンポーネントをそのまま使えません。Chakra のコンポーネントファイルには `"use client"` が付いています。今回の Vite + SPA 構成では気にしなくて大丈夫です。

## 今後に活かせるポイント

- ライブラリを導入するときは、その `package.json` の `peerDependencies` を確認する癖をつけると「動かない原因」を早く特定できます。
- 開発者ツールで `--chakra-...` の CSS 変数を見れば、どのトークンが効いているかを追跡できます。

## 改善するなら

現状、特に問題はありません。将来 Next.js（App Router）に移行する場合は、Chakra を使うコンポーネントを Client Component にする（`"use client"`）必要がある点だけ覚えておきましょう。

## 次に学ぶこと

- Panda CSS（Chakra チームが作った、ビルド時に CSS を生成するライブラリ。v3 の設計思想の元になっている）
- CSS カスケードレイヤー `@layer` の仕組み
