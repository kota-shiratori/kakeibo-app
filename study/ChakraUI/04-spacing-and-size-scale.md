# スペーシングスケールとサイズトークン（py={4} は何 px？）

## 概要

Chakra UI では余白（padding / margin / gap）に **スペーシングスケール** という数値の目盛りを使います。
`4` は `1rem`、つまりブラウザ標準のフォントサイズ（16px）なら **16px** です。基本的に **「数値 × 4px」** と覚えておけばOKです。

幅（`width` / `maxW`）には、スペーシングの数値に加えて `sm`・`xl`・`4xl` などの **名前付きサイズ** も使えます。

## このプロジェクトでの実装

| 箇所 | 指定 | 実際の値（16px 基準） |
| --- | --- | --- |
| `web-app/src/components/Header.tsx:9` | `py={4}` | 上下 1rem = 16px |
| `web-app/src/pages/Home.tsx:24` | `py={6}` | 上下 1.5rem = 24px |
| `web-app/src/pages/Home.tsx:24` | `maxW="4xl"` | 最大幅 56rem = 896px |
| `web-app/src/pages/Home.tsx:25` | `gap={6}` | 1.5rem = 24px |
| `web-app/src/pages/Input.tsx:59` | `maxW="xl"` | 最大幅 36rem = 576px |
| `web-app/src/pages/Input.tsx:60` | `width="full"` | 100% |
| `web-app/src/pages/Input.tsx:61` | `gap={4}` | 1rem = 16px |
| `web-app/src/pages/Input.tsx:71` | `gap={4}`（HStack） | 1rem = 16px |
| `web-app/src/pages/Input.tsx:112` | `width="sm"` / `mt={4}` / `gap={3}` | 24rem = 384px / 16px / 0.75rem = 12px |

### スペーシングトークン（`node_modules/@chakra-ui/react/dist/esm/theme/tokens/spacing.js` より抜粋）

| トークン | 値 | px（16px 基準） |
| --- | --- | --- |
| 0.5 | 0.125rem | 2px |
| 1 | 0.25rem | 4px |
| 2 | 0.5rem | 8px |
| 3 | 0.75rem | 12px |
| 4 | 1rem | 16px |
| 5 | 1.25rem | 20px |
| 6 | 1.5rem | 24px |
| 8 | 2rem | 32px |
| 10 | 2.5rem | 40px |
| 12 | 3rem | 48px |
| 16 | 4rem | 64px |

（0.5〜4.5 は 0.5 刻み、その先は 5〜12 の整数と 14, 16, 20, 24 … 96 まで定義あり。13, 15, 17〜19 などは定義されていないので注意）

### 名前付きサイズ（`theme/tokens/sizes.js` より抜粋）

| トークン | 値 | px |
| --- | --- | --- |
| xs | 20rem | 320px |
| sm | 24rem | 384px |
| md | 28rem | 448px |
| lg | 32rem | 512px |
| xl | 36rem | 576px |
| 2xl | 42rem | 672px |
| 3xl | 48rem | 768px |
| 4xl | 56rem | 896px |
| 8xl | 90rem | 1440px |
| full | 100% | — |

`sizes` にはスペーシングの値（`4` = 1rem など）や分数（`1/2` = 50%）も含まれています。

## 重要語句

| 語句 | 意味 |
| --- | --- |
| スペーシングスケール | 余白に使う数値の目盛り。1 = 0.25rem |
| rem | ルート要素（html）のフォントサイズを基準にした単位。標準では 1rem = 16px |
| sizes トークン | width / height / maxW などで使うサイズの名前 |

## 仕様・注意点

- **同じ名前でもカテゴリで値が違います**。`fontSize="xl"` は 1.25rem（20px）ですが、`maxW="xl"` は 36rem（576px）です。`sm` も、`width="sm"` は 384px、`fontSize="sm"` は 14px。名前はカテゴリ（fontSizes / sizes）ごとに別物です。
- rem 基準なので、ユーザーがブラウザの文字サイズ設定を大きくすると余白も一緒に大きくなります（アクセシビリティ上の利点）。
- 定義されていない数値（例: `px={13}`）は、トークンが見つからないため数値 `13` のまま CSS に渡され、emotion が px を補って `13px` になります（`defaultSystem.css({ px: 13 })` の出力が `paddingInline: 13` になることを確認）。つまり「スケールの 13（3.25rem）」にはならず、トークン `4`（16px）とは単位の意味が変わってしまうので混乱のもとです。直値を使うなら `px="13px"` のように単位付きで明示しましょう。
- `width="sm"`（固定 384px）は、画面幅がそれより狭いスマホではみ出す原因になります（下の改善案参照）。

## 今後に活かせるポイント

- 「4px グリッド」で余白を揃えると、デザインに統一感が出ます。Tailwind CSS も同じ目盛り（`p-4` = 1rem）なので、知識を流用できます。
- 幅の上限は `maxW`、幅そのものは `width` と使い分けると、レスポンシブに強いレイアウトになります。

## 改善するなら

`Input.tsx:112` のボタン行は `width="sm"`（384px 固定）なので、狭い画面ではみ出す可能性があります。`maxW` と `width="full"` の組み合わせにすると安全です。

```tsx
// Before
<HStack width="sm" mt={4} gap={3}>

// After: 最大 384px、それより狭い画面では 100%
<HStack width="full" maxW="sm" mt={4} gap={3}>
```

## 次に学ぶこと

- `createSystem` で spacing / sizes トークンを追加・上書きする方法
- レスポンシブ値（`{ base: 4, md: 6 }`）
