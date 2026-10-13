# oxlint の React ルール（rules-of-hooks / only-export-components と Fast Refresh）

## 概要

`web-app/.oxlintrc.json` で明示的に設定されている 2 つのルールは、どちらも React 開発で重要なものです。

| ルール | 重大度 | 目的 |
| --- | --- | --- |
| `react/rules-of-hooks` | error | **フックの呼び出しルール違反**（条件分岐の中で `useState` を呼ぶなど）を検出。バグに直結する |
| `react/only-export-components` | warn | **Fast Refresh が正しく動かなくなる export** を検出。開発体験に関わる |

（フック自体の使い方の解説は study/React 担当。ここでは「ツールとしてなぜこのルールがあるのか」に絞ります。）

## このプロジェクトでの実装

```jsonc
// web-app/.oxlintrc.json:4-7
"rules": {
  "react/rules-of-hooks": "error",
  "react/only-export-components": ["warn", { "allowConstantExport": true }]
}
```

### 1. `react/rules-of-hooks`（`web-app/.oxlintrc.json:5`）

React のフック（`useState`, `useEffect`, 自作の `useXxx` など）には次のルールがあります。

- コンポーネントまたはカスタムフックの**トップレベルでのみ**呼ぶ（if / for / ネストした関数の中で呼ばない）
- React の関数コンポーネントかカスタムフック**以外からは呼ばない**

React はフックを「呼ばれた順番」で管理しているため、条件によって呼ぶ回数が変わると状態がずれて壊れます。これは**実行してみないと気づきにくく、かつ確実にバグになる**ので、`error` に設定されています。

このプロジェクトでは `web-app/src/hooks/` に `useIncomeTransactions.ts` などのカスタムフックがあり、名前が `use` で始まるので、このルールの検査対象になります（現在違反はなし）。

### 2. `react/only-export-components`（`web-app/.oxlintrc.json:6`）

#### Fast Refresh の仕組みと制約

`@vitejs/plugin-react` が提供する **Fast Refresh** は、ファイルを編集したとき、そのファイルの React コンポーネントだけを差し替えて状態を保持します。しかし、

- ファイルが **コンポーネント以外のもの**（普通の関数、オブジェクト、カスタムフックなど）も export していると、
- それを import している側に影響が及ぶ可能性があるため、安全に差し替えられず、

**状態を保持した更新ができなくなります**（モジュールの無効化が親へ伝播し、最悪ページ全体のリロードになる）。

`@vitejs/plugin-react` の README（`web-app/node_modules/@vitejs/plugin-react/README.md` の「Consistent components exports」）にも次のように書かれています。

> For React refresh to work correctly, your file should only export React components.

> If an incompatible change in exports is found, the module will be invalidated and HMR will propagate. To make it easier to export simple constants alongside your component, the module is only invalidated when their value changes.

そしてこの README は、この問題を検出するために **この oxlint ルール**（または ESLint / Biome の同等ルール）を紹介しています。

#### `allowConstantExport: true` の意味

oxlint のスキーマ（`web-app/node_modules/oxlint/configuration_schema.json` の `OnlyExportComponentsConfig`）の説明:

> Allow exporting primitive constants (string/number/boolean/template literal) alongside component exports without triggering a violation. Recommended when your bundler's Fast Refresh integration supports this (enabled by the plugin's `vite` preset).

つまり、

```tsx
export const VERSION = "3";          // ← 文字列の定数
export const Foo = () => null;       // ← コンポーネント
```

のように、**プリミティブな定数**（文字列・数値・真偽値・テンプレートリテラル）だけなら一緒に export しても警告しない、というオプションです。デフォルトは `false`。

これが許される理由は、上の README にある通り **Vite（plugin-react）が「定数の値が変わったときだけ」モジュールを無効化する**ように対応しているからです。Vite を使っているからこそ有効にできるオプションです。

#### どんなときに警告されるか（例）

```tsx
// 警告される例: コンポーネントとカスタムフック・ユーティリティ関数を同じファイルから export
export const Header = () => <header>...</header>;
export const useSomething = () => { /* ... */ };     // ← コンポーネントではない
export function formatYen(n: number) { /* ... */ }   // ← コンポーネントではない
```

対策はファイルを分けることです（コンポーネントは `components/`、フックは `hooks/`、関数は `utils/` など）。このプロジェクトはすでに `web-app/src/components/`・`web-app/src/hooks/`・`web-app/src/pages/` と分かれており、ルールに沿った構成になっています。

## 重要語句

- **Rules of Hooks**: フックをトップレベルでのみ、React 関数からのみ呼ぶというルール。
- **Fast Refresh**: React 向けの HMR。状態を保ったままコンポーネントを差し替える。
- **HMR の伝播（propagation）**: 変更モジュールを安全に差し替えられないとき、import 元へさかのぼって再実行範囲を広げること。
- **プリミティブ定数**: 文字列・数値・真偽値などの単純な値の定数。
- **`allowConstantExport`**: プリミティブ定数の export を許可するオプション。

## 仕様・注意点

- `only-export-components` は **warn** なので、違反しても動作はします。ただ「保存しても状態がリセットされる」「HMR が効かずリロードされる」といった**開発時の不便**として現れます。
- `allowConstantExport` が許すのは**プリミティブ定数だけ**です。オブジェクトや配列（例: `export const COLORS = { ... }`）は対象外で警告されます。コンポーネントの集合オブジェクトを許可したい場合は別オプション `allowCompoundComponents` があります（同スキーマに記載）。
- `main.tsx` のように**何も export しないエントリーファイル**は検査対象として問題になりません。
- Context（`createContext`）とその Provider コンポーネントを同じファイルから export すると警告されがちです。Context 自体は別ファイルに分けるのが定石です。
- oxlint の設定ではルール名の前に `react/` を付けますが、内部的には ESLint の `eslint-plugin-react-hooks` / `eslint-plugin-react-refresh` 由来のルールも `react` プラグインにまとめられています（`rules-of-hooks`, `exhaustive-deps`, `only-export-components` はすべて `react/`）。

## 今後に活かせるポイント

- 「Linter のルール」と「ツール（Vite）の仕組み」が密接に結びついている好例。ルールの理由を知ると、ファイル分割の方針（1 ファイル 1 コンポーネント、フックは別ファイル）に納得感が持てる。
- ESLint 環境に移っても、同じ目的のルール（`eslint-plugin-react-hooks` の `rules-of-hooks`、`eslint-plugin-react-refresh` の `only-export-components`）が使われている。

## 改善するなら

- `react/exhaustive-deps`（`useEffect` の依存配列の漏れ検出）は現在 correctness カテゴリとして **warn** で有効です（`npx oxlint --print-config` で確認）。重要度が高いと判断するなら明示的に error にする選択肢もある。
  ```jsonc
  "react/exhaustive-deps": "error"
  ```
- 現在出ている `react/set-state-in-effect` の warning 2 件（`web-app/src/hooks/useExpenseTransactions.ts:31`, `web-app/src/hooks/useIncomeTransactions.ts:31`）を解消し、その後 `oxlint --deny-warnings` で warning ゼロを維持する運用にする（修正方針は study/React 参照）。

## 次に学ぶこと

- React Compiler と、それに関連する oxlint の React ルール（`react/purity`, `react/immutability` など。print-config に含まれている）
- `jsx-a11y` プラグインによるアクセシビリティ検査
- `react-perf` プラグインによるレンダリング性能の検査
