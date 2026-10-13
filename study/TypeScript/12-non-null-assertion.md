# 非 null アサーション `!`

## 概要

式の後ろに `!` を付けると、「この値は `null` でも `undefined` でもない」と **コンパイラに言い切る** ことができます（非 null アサーション / non-null assertion）。型から `null` と `undefined` が取り除かれます。

ただしこれは **実行時には何もチェックしない** ので、もし実際に `null` だった場合は実行時エラーになります。「プログラマが責任を持つ」という宣言です。

## このプロジェクトでの実装

`web-app/src/main.tsx:6`

```ts
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    ...
  </StrictMode>,
);
```

- `document.getElementById` の戻り値型は `HTMLElement | null` です（`web-app/node_modules/typescript/lib/lib.dom.d.ts:13080`）。
- `createRoot` は `null` を受け取れないため、`!` なしだと型エラーになります。
- `web-app/index.html` に `<div id="root"></div>` があることは開発者が分かっているので、`!` で `HTMLElement` として扱っています。これは Vite の React テンプレートが生成する標準的なコードです。

ビルド後の JavaScript では `!` は単に消えます。

```js
createRoot(document.getElementById("root")).render(...)
```

## 重要語句

| 用語 | 意味 |
| --- | --- |
| 非 null アサーション | `expr!`。型から `null` / `undefined` を除く。実行時の処理はない |
| 論理否定 `!expr` | 前に付ける `!` は JavaScript の否定演算子で、まったくの別物 |
| 型アサーション `as` | 型を言い切る、より一般的な仕組み（→ `13-type-assertion-as.md`） |

## 仕様・注意点

- **前置 `!x` と後置 `x!` は別物。** `!transactionList?.transactions.length`（`TransactionList.tsx:96`）の `!` は「否定」、`getElementById("root")!` の `!` は「非 null アサーション」です。
- `x!` は `x as NonNullable<typeof x>` とほぼ同じ意味です。
- 間違っていた場合、エラーは `!` の場所ではなく、その値を使った場所（`createRoot` 内部など）で起きるため、原因が分かりにくくなります。
- `!` は TypeScript 固有の構文ですが、型注釈と同じく「消すだけで JS になる」構文なので、`erasableSyntaxOnly: true`（web-app の設定）でも使えます。
- lint ルール（typescript-eslint の `no-non-null-assertion` など）で禁止しているプロジェクトもあります。

## 今後に活かせるポイント

- `!` を使ってよいのは「ほぼ確実に存在し、存在しなければアプリがそもそも動かない」ような場所（エントリポイントのルート要素など）に限るのが無難です。
- それ以外では、`if` で `null` チェックして絞り込むか、見つからない場合に分かりやすいエラーを投げるほうが安全です。

## 改善するなら

ルート要素が見つからなかったときに、原因が分かるエラーメッセージを出す書き方です。`if` で `null` を除外すると、それ以降は型が `HTMLElement` に絞り込まれるので `!` が不要になります。

```ts
const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error('id="root" の要素が index.html に見つかりません');
}

createRoot(rootElement).render(
  <StrictMode>
    <ChakraProvider value={defaultSystem}>
      <App />
    </ChakraProvider>
  </StrictMode>,
);
```

もっとも、このケースはテンプレートの定型コードであり、現状のままでも実害はほぼありません。

## 次に学ぶこと

- 型アサーション `as` とその危険性 → `13-type-assertion-as.md`
- アサーション関数 `function assert(v: unknown): asserts v` — 「チェックして、通れば型を絞り込む」関数
- `noUncheckedIndexedAccess` を有効にすると `!` を書きたくなる場面が増えるので、その対処法
