# resolve.tsconfigPaths（`@/` エイリアスをビルドツールに解決させる）

## 概要

深い階層から `../../components/Header` のように相対パスで import すると読みにくく、ファイル移動にも弱くなります。そこで `@/components/Header` のような**パスエイリアス**を使います。

ただし、エイリアスは**2 か所で解決できる必要があります**。

| 誰が | 何のために | 設定場所 |
| --- | --- | --- |
| TypeScript（tsc・エディタ） | 型チェック・補完 | `tsconfig.app.json` の `paths` |
| Vite（開発サーバ・ビルド） | 実際にファイルを読み込む | `vite.config.ts` |

tsconfig の `paths` は**型チェック用の情報にすぎず、JS の出力や実行時の解決には影響しません**。そのため以前は Vite 側にも `resolve.alias` を書くか、`vite-tsconfig-paths` プラグインを入れる必要がありました。

**Vite 8 では `resolve.tsconfigPaths: true` を指定するだけで、tsconfig の `paths` を Vite がネイティブに解決**してくれます。

## このプロジェクトでの実装

### tsconfig 側（型チェック用）

```jsonc
// web-app/tsconfig.app.json:10-12
"paths": {
  "@/*": ["./src/*"],
},
```

`@/xxx` → `./src/xxx` という対応です（`paths` の意味の詳細は study/TypeScript 参照）。

### Vite 側（実際の解決用）

```ts
// web-app/vite.config.ts:7-9
resolve: {
  tsconfigPaths: true,
},
```

### 実際の使用箇所

```ts
// web-app/src/App.tsx:2-3
import Home from "@/pages/Home";
import Input from "@/pages/Input";
// web-app/src/pages/Input.tsx:1-2
import { Header } from "@/components/Header";
import { useAddTransactions } from "@/hooks/useAddTransactions";
```

### node_modules で確認した事実

Vite 8.3.1 の型定義 `web-app/node_modules/vite/dist/node/index.d.ts` には次のように書かれています。

```ts
interface ResolveOptions extends EnvironmentResolveOptions {
  /**
   * Enable tsconfig paths resolution
   *
   * @default false
   */
  tsconfigPaths?: boolean;
}
```

- **デフォルトは `false`**。書かなければ有効になりません。
- 値は `boolean` のみ。

さらに Vite 本体（`vite/dist/node/chunks/node.js`）には、`vite-tsconfig-paths` / `vite-plugin-tsconfig-paths` プラグインを検出すると次の警告を出すコードがあります。

> Vite now supports tsconfig paths resolution natively via the resolve.tsconfigPaths option. You can remove the plugin and set resolve.tsconfigPaths: true in your Vite config instead.

つまり、**Vite 8 では従来のプラグインは不要になり、この設定が推奨**されています。内部では、この値が Rolldown 側のモジュール解決（resolver）の `tsconfigPaths` オプションとして渡されています。

## 重要語句

- **パスエイリアス**: 長い相対パスの代わりに使う短い別名（`@/` など）。
- **`paths`**: tsconfig でエイリアスを定義するオプション。型チェックにのみ影響する。
- **`resolve.alias`**: Vite で任意のエイリアスを定義する従来の方法。
- **`resolve.tsconfigPaths`**: Vite 8 の、tsconfig の `paths` を自動で読み取って解決する設定。
- **モジュール解決（module resolution）**: `import "x"` の `"x"` を実際のファイルパスに変換する処理。

## 仕様・注意点

- **tsconfig と Vite の両方が揃って初めて動く。** `paths` だけ書くとエディタではエラーが出ないのに、`npm run dev` で「ファイルが見つからない」エラーになる。逆に Vite 側だけだと動くが型エラーになる。
- **Vite 7 以前では使えません**。古い記事どおりに `vite-tsconfig-paths` を入れると、Vite 8 では上記の警告が出ます。
- web-app は `tsconfig.json` が `references` で分割されており、`paths` は `src/` を対象とする `tsconfig.app.json` にだけ書かれています（`vite.config.ts` 用の `tsconfig.node.json` にはない）。現状 `@/` で import しているのは `src/` 内のファイルだけなので、この配置で動作しています。もし `paths` を別の tsconfig に移したり、`src/` 以外で `@/` を使ったりする場合は、Vite 側で解決されるか動作確認してください。
- **backend では `paths` を使っていません**。backend は tsc の出力を Node.js がそのまま実行するので、`paths` を使うと出力された JS に `@/...` が残って実行時に解決できなくなります（tsc は import パスを書き換えない）。Node.js 側でエイリアスを使うなら、package.json の `imports` フィールド（`#src/*` 形式）を使うのが標準的な方法です。

## 今後に活かせるポイント

- 「**型チェッカーの解決**」と「**実行環境 / バンドラの解決**」は別物で、両方を一致させる必要がある、という原則はあらゆる TS プロジェクトで重要。
- ツールのメジャーアップデートでは、「プラグインで実現していたことが本体に取り込まれる」ことがよくある。CHANGELOG や型定義を読む習慣が役に立つ。

## 改善するなら

- 現状の設定は Vite 8 の推奨どおりで問題ありません。
- import の書き方を統一するとより読みやすくなります。現在 `web-app/src/main.tsx:3` は `./App`（相対）、`web-app/src/App.tsx:2` は `@/pages/Home`（エイリアス）と混在しています。「別ディレクトリへの import は `@/`、同じディレクトリ内は `./`」のようにルールを決めるとよい。
- backend でもエイリアスを使いたくなったら、`package.json` の `imports` フィールド（Node.js 標準の Subpath Imports。`#` で始まる名前を使う）を検討する。
  ```json
  "imports": { "#src/*": "./dist/*" }
  ```
  ※ 開発時（tsx は `src/*.ts` を実行）と本番（`dist/*.js` を実行）で指す先が変わるため、そのままでは両立しません。条件付き imports などの工夫が必要なので、導入前に tsx・tsc 両方で動作を検証すること。

## 次に学ぶこと

- package.json の `imports` フィールド（Subpath Imports）
- `resolve.alias` の高度な使い方（正規表現でのマッチなど）
- Vitest でのエイリアス解決（Vite の設定を共有すれば同じく効く）
