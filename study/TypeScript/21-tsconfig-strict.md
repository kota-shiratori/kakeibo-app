# strict モード（とその既定値の変化）

## 概要

`strict: true` は、TypeScript の厳格な型チェックオプションをまとめて有効にするスイッチです。`null` / `undefined` の扱い、暗黙の `any`、catch 変数の `unknown` 化など、このノート集で扱ってきた多くの安全性は `strict` によって支えられています。

重要な事実として、**TypeScript 6.0 から `strict` の既定値が `true` になりました。** web-app の `tsconfig.app.json` には `strict` が書かれていませんが、それでも strict モードで型チェックされています。

## このプロジェクトでの実装

backend は明示しています。

`backend/tsconfig.json:5`

```json
"strict": true,
```

web-app の `web-app/tsconfig.app.json` と `web-app/tsconfig.node.json` には `strict` の記述がありません。それでも有効になっている根拠:

- TypeScript 6.0.3 の `web-app/node_modules/typescript/lib/_tsc.js:18280` に、各 strict 系フラグの値を決める関数があります。

  ```js
  function getStrictOptionValue(compilerOptions, flag) {
    return compilerOptions[flag] === void 0 ? compilerOptions.strict !== false : !!compilerOptions[flag];
  }
  ```

  個別フラグが未指定なら `strict !== false`、つまり **`strict` を書いていなければ true** になります（5.x までは `!!compilerOptions.strict` で、未指定なら false でした）。
- 実際に `strict` を書かない tsconfig で、TS 6.0.3 / 7.0.2 の両方で以下のエラーが出ることを確認しました。

  ```
  error TS7006: Parameter 'x' implicitly has an 'any' type.          (noImplicitAny)
  error TS2322: Type 'null' is not assignable to type 'string'.      (strictNullChecks)
  error TS18047: 'el' is possibly 'null'.                            (strictNullChecks)
  error TS18046: 'e' is of type 'unknown'.                           (useUnknownInCatchVariables)
  ```

このプロジェクトのコードで strict が効いている場面:

| strict 系オプション | 効いている場所 | 関連ノート |
| --- | --- | --- |
| `strictNullChecks` | `getElementById("root")!`（`main.tsx:6`）、`transactionList?.`（`TransactionList.tsx:96`）、`useState<T>()` が `T \| undefined` | 10, 11, 12 |
| `noImplicitAny` | props や関数引数に型注釈が必須（`({ maxTransactions }: Props)` など） | 08 |
| `useUnknownInCatchVariables` | `catch (err)` の `err` が `unknown` → `instanceof Error` | 15 |
| `strictFunctionTypes` | 関数型プロパティの引数を厳密にチェック | 06 |

## 重要語句

`strict: true` で有効になる主なオプション:

| オプション | 内容 |
| --- | --- |
| `strictNullChecks` | `null` / `undefined` を他の型と区別する |
| `noImplicitAny` | 暗黙の `any` をエラーにする |
| `strictFunctionTypes` | 関数型の引数を反変（contravariant）にチェックする（メソッド記法は除く） |
| `strictBindCallApply` | `fn.call` / `bind` / `apply` の引数をチェックする |
| `strictPropertyInitialization` | クラスのプロパティがコンストラクタで初期化されているかをチェックする |
| `noImplicitThis` | 型が `any` になる `this` をエラーにする |
| `useUnknownInCatchVariables` | `catch` 変数を `unknown` にする |
| `alwaysStrict` | 出力 JS に `"use strict"` を付け、strict モードとして解析する |
| `strictBuiltinIteratorReturn` | 組み込みイテレータの戻り値型を厳密にする（TS 5.6〜） |

## 仕様・注意点

- **個別に無効化できます**: `"strict": true, "noImplicitAny": false` のように、`strict` を有効にしつつ一部だけ切ることができます（移行期のプロジェクトでよく使われます）。
- **`strict` に含まれない有用なオプション**もあります: `noUncheckedIndexedAccess`、`exactOptionalPropertyTypes`、`noImplicitReturns`、`noImplicitOverride`、`noPropertyAccessFromIndexSignature` など。
- **将来のバージョンで `strict` に含まれるオプションが増える** 可能性があります（実際に `useUnknownInCatchVariables` は 4.4、`strictBuiltinIteratorReturn` は 5.6 で追加）。TypeScript をアップデートしたら新しいエラーが出る、ということが起こり得ます。
- TypeScript 6.0 では `alwaysStrict: false` が非推奨になりました（`_tsc.js` の非推奨チェックで確認）。
- 既定値が変わったとはいえ、**`strict: true` を明示しておくほうが、読み手にも、古い TypeScript や他ツールにも意図が伝わります**。

## 今後に活かせるポイント

- 新規プロジェクトでは最初から `strict: true`。途中から有効にするとエラーが大量に出て大変です。
- さらに安全にしたいなら、`noUncheckedIndexedAccess` を追加するのがおすすめです（配列・インデックスアクセスに `| undefined` が付く）。

## 改善するなら

web-app の 2 つの tsconfig にも `strict: true` を明示し、さらに `noUncheckedIndexedAccess` を検討します。

```json
// web-app/tsconfig.app.json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    ...
  }
}
```

`noUncheckedIndexedAccess` を有効にすると、`formatDate`（`web-app/src/components/TransactionList.tsx:180`）の `parts[0]` などが `string | undefined` になります。テンプレートリテラルに埋め込むだけならエラーにはなりませんが、「`"2025/09/25"` のように `-` 区切りでない文字列が来たら `"2025/09/25年undefined月undefined日"` になる」という潜在バグに気付くきっかけになります。

## 次に学ぶこと

- `noUncheckedIndexedAccess` / `exactOptionalPropertyTypes`
- `tsc --showConfig` で実際に有効な設定を確認する方法
- TypeScript 6.0 で変わったその他の既定値 → `28-typescript-6-and-7.md`
