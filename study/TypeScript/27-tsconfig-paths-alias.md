# paths によるパスエイリアス（`@/*`）

## 概要

`paths` を設定すると、`import { Header } from "@/components/Header"` のように、**相対パス（`../../`）ではなく決まった起点からのパスで import** できるようになります。ファイルの階層が深くなっても import 文が読みやすく、ファイルを移動したときの修正も楽になります。

ただし `paths` は **TypeScript の型チェック上の解決ルールを変えるだけ** で、実行時（ビルド時）の解決は別のツール（このプロジェクトでは Vite）が行います。両方の設定が揃って初めて動きます。

## このプロジェクトでの実装

`web-app/tsconfig.app.json:10`

```json
"paths": {
  "@/*": ["./src/*"],
},
```

- `@/` で始まる import を `./src/` からのパスとして解決します。`*` の部分がそのまま置き換わります。
- パスは **この tsconfig ファイルのある場所（`web-app/`）からの相対パス** として解釈されます。

使用例:

`web-app/src/App.tsx:2`

```ts
import Home from "@/pages/Home";
import Input from "@/pages/Input";
```

`web-app/src/pages/Home.tsx:16`

```ts
import { Header } from "@/components/Header";
```

実行時の解決は Vite の設定で行われています（`web-app/vite.config.ts:7`）。

```ts
resolve: {
  tsconfigPaths: true,
},
```

これにより Vite が tsconfig の `paths` を読んで、同じルールで解決します（Vite の設定の詳細は Tooling フォルダの担当範囲）。

## 重要語句

| 用語 | 意味 |
| --- | --- |
| paths | import パスのパターンを実際のパスに対応付ける tsconfig のオプション |
| パスエイリアス | `@/` のような、パスの別名 |
| baseUrl | 非相対 import の起点ディレクトリを決める旧オプション。TS 6.0 で非推奨、7.0 で削除 |

## 仕様・注意点

- **`baseUrl` は書かれていませんが、それが正しい書き方です。** かつて `paths` は `baseUrl` とセットで使うものでしたが、TS 4.1 以降は `baseUrl` なしでも `paths` を使えるようになり（その場合 tsconfig の場所が起点）、さらに:
  - TypeScript 6.0: `baseUrl` は **非推奨**。指定すると次のエラーになります（6.0.3 で確認）。

    ```
    error TS5101: Option 'baseUrl' is deprecated and will stop functioning in TypeScript 7.0.
    Specify compilerOption '"ignoreDeprecations": "6.0"' to silence this error.
    ```

  - TypeScript 7.0: `baseUrl` は **削除**。指定すると次のエラーになります（7.0.2 で確認）。

    ```
    error TS5102: Option 'baseUrl' has been removed. Please remove it from your configuration.
      Use '"paths": {"*": ["./*"]}' instead.
    ```

  古い記事にある `"baseUrl": "."` + `"paths"` の書き方を真似しないよう注意しましょう。
- **TypeScript は import パスを書き換えません。** `tsc` で JS を出力しても `"@/pages/Home"` はそのまま残ります。web-app は `noEmit` で Vite がビルドするので問題ありませんが、tsc の出力を Node.js で直接実行する backend に同じ方法でエイリアスを導入すると、実行時に解決できず失敗します（backend なら `package.json` の `imports` を使うのが安全 → `19-esm-import-extension.md`）。
- **`paths` は書いた tsconfig にしか効きません。** `tsconfig.node.json` には `paths` が無いので、`vite.config.ts` から `@/` は使えません。
- このプロジェクトでは `@/` を使った import と相対 import（`"../components/TransactionList"`、`Home.tsx:15`）が混在しています。
- tsconfig の `"@/*": ["./src/*"],` などの末尾のカンマ（`tsconfig.app.json:11`, `:26`, `:28`）は厳密な JSON では不正ですが、tsconfig は JSONC（コメント・末尾カンマを許す形式）として読まれるので問題ありません。

## 今後に活かせるポイント

- エイリアスは `@/*` → `src/*` の 1 つに絞ると覚えやすく、多くのテンプレート（Next.js、shadcn/ui など）とも揃います。
- 「型チェック（tsconfig）」と「実行/ビルド（Vite、Vitest、Node.js など）」の **両方** でエイリアスが解決されるよう設定することを忘れない。

## 改善するなら

import の書き方を統一すると読みやすくなります。たとえば「同じフォルダ内は相対パス、それ以外は `@/`」のようなルールにします。

```ts
// web-app/src/pages/Home.tsx
import {
  RecentExpenseTransactionList,
  RecentIncomeTransactionList,
} from "@/components/TransactionList";  // "../components/TransactionList" から変更
import { Header } from "@/components/Header";
```

lint ルール（import 順序・パス形式を統一するもの）で強制することもできます。

## 次に学ぶこと

- Node.js の subpath imports（`package.json` の `"imports"`、`#` 始まりの import）
- Vitest など他ツールでのエイリアス設定
- モノレポでのパッケージ間 import（`workspace:` プロトコル）
