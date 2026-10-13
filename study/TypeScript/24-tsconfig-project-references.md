# プロジェクト参照（tsconfig.json → app / node）と tsBuildInfoFile

## 概要

web-app には tsconfig が 3 つあります。

- `tsconfig.json` — 自分では何もチェックせず、2 つの子プロジェクトを **参照（references）** するだけの「親」
- `tsconfig.app.json` — ブラウザで動く `src/` 用
- `tsconfig.node.json` — Node.js で動く `vite.config.ts` 用

同じフォルダの中に「ブラウザで動くコード」と「Node.js で動くコード」が混在しているため、**実行環境ごとに別々の設定で型チェックする** ための構成です。これは Vite の React テンプレートの標準構成です。

## このプロジェクトでの実装

`web-app/tsconfig.json:1`

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

- `"files": []` で、この親設定自体はファイルを 1 つも対象にしません（空にしないと、デフォルトの `**/*` が対象になり、どちらの設定でもない中途半端なチェックが走ってしまう）。
- `references` で 2 つの子プロジェクトを束ねます。

`web-app/tsconfig.app.json:3`, `:28`

```json
"tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
...
"include": ["src"],
```

`web-app/tsconfig.node.json:3`, `:22`

```json
"tsBuildInfoFile": "./node_modules/.tmp/tsconfig.node.tsbuildinfo",
...
"include": ["vite.config.ts"]
```

ビルドスクリプト（`web-app/package.json:8`）:

```json
"build": "tsc -b && vite build",
```

- `tsc -b`（`--build`）は **ビルドモード** で、`tsconfig.json` の `references` をたどって各子プロジェクトを順に型チェックします。
- 両方とも `noEmit: true` なので JS は出力しません。`tsc -b` は「型チェックだけ」を担当し、JS の生成とバンドルは `vite build` が担当します。
- 型エラーがあると `tsc -b` が失敗し、`&&` により `vite build` は実行されません（Vite 自身は型チェックをしないため、この順番で型エラーのあるビルドを防いでいます）。

### 2 つの子プロジェクトの違い

| 項目 | tsconfig.app.json（src） | tsconfig.node.json（vite.config.ts） |
| --- | --- | --- |
| 実行環境 | ブラウザ | Node.js |
| `target` | `ESNext` | `es2023` |
| `lib` | `["ES2023", "DOM"]` | `["ES2023"]` |
| `types` | `["vite/client"]` | `["node"]` |
| `module` | `ESNext` | `nodenext` |
| `moduleResolution` | `bundler` | 未指定（`module: nodenext` から自動で `NodeNext`） |
| `jsx` | `react-jsx` | なし |
| `paths` | `"@/*"` | なし |

## tsBuildInfoFile とは

- ビルドモード（や `incremental: true`）では、TypeScript は前回のチェック結果（各ファイルのハッシュや依存関係、エラー情報など）を **`.tsbuildinfo` ファイル** に保存し、次回は変更のあったファイルとその影響範囲だけを再チェックします（インクリメンタルビルド）。
- `tsBuildInfoFile` はその保存先です。`node_modules/.tmp/` に置くことで、ソースフォルダを汚さず、`node_modules` ごと `.gitignore` の対象にできます。
- 実際に `web-app/node_modules/.tmp/` には `tsconfig.app.tsbuildinfo` と `tsconfig.node.tsbuildinfo` が生成されています。

## 重要語句

| 用語 | 意味 |
| --- | --- |
| プロジェクト参照 (project references) | `references` で複数の tsconfig を関連付ける仕組み（TS 3.0〜） |
| ビルドモード (`tsc -b`) | 参照をたどって複数プロジェクトを依存順にビルドするモード |
| solution-style tsconfig | `files: []` + `references` だけを持つ、束ね役の tsconfig |
| tsbuildinfo | インクリメンタルビルド用のキャッシュファイル |
| composite | 他プロジェクトから参照されるプロジェクト向けの設定（宣言ファイル出力などを強制）。このプロジェクトでは未使用 |

## 仕様・注意点

- **`tsc -b` と `tsc -p` の違い**: `tsc -p tsconfig.json` を実行しても、親は `files: []` なので何もチェックしません。全体をチェックするには `tsc -b` を使います（個別なら `tsc -p tsconfig.app.json`）。
- **エディタ（VS Code）** は、開いたファイルがどの子プロジェクトの `include` に含まれるかを `references` から判断し、適切な設定で型チェックします。`src/*.tsx` を開けば `tsconfig.app.json`、`vite.config.ts` を開けば `tsconfig.node.json` の設定が使われます。
- **どの `include` にも入らないファイル** を作ると（例: web-app 直下に `scripts/foo.ts`）、`tsc -b` ではチェックされません。
- `tsbuildinfo` が古い状態で残っておかしな挙動をした場合は、`tsc -b --clean` するか `node_modules/.tmp` を削除します。

## 今後に活かせるポイント

- 「1 つのリポジトリに実行環境の違うコードがある」場合（フロントエンド + 設定ファイル、アプリ + テスト、モノレポの複数パッケージ）は、tsconfig を分けて `references` で束ねる。
- 共通の設定は `tsconfig.base.json` などに書いて `extends` で継承すると重複が減ります。

## 改善するなら

`tsconfig.app.json` と `tsconfig.node.json` には共通のオプション（`skipLibCheck`、`verbatimModuleSyntax`、`moduleDetection`、`noEmit`、Linting 系）が重複しているので、共通部分を `extends` でまとめられます。

```json
// web-app/tsconfig.base.json
{
  "compilerOptions": {
    "strict": true,
    "skipLibCheck": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "allowImportingTsExtensions": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

```json
// web-app/tsconfig.app.json
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "target": "ESNext",
    "lib": ["ES2023", "DOM"],
    ...
  },
  "include": ["src"]
}
```

ただし、テンプレートの構成から離れるほど将来のテンプレート更新との差分比較がしにくくなるので、小規模なうちは現状のままでも十分です。

また、型チェックだけを単独で実行できるスクリプトがあると便利です。

```json
"typecheck": "tsc -b"
```

## 次に学ぶこと

- `composite` / `declaration` と、モノレポでのプロジェクト参照（型を共有するパッケージを作る → `29-type-sharing-fe-be.md`）
- `extends` による設定の継承
- `incremental` オプション
