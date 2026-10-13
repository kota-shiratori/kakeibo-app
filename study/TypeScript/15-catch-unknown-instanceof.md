# catch の err は unknown — instanceof で絞り込む

## 概要

JavaScript の `throw` は `Error` オブジェクトに限らず **どんな値でも投げられます**（`throw "文字列"`、`throw 42`、`throw null` も合法）。そのため TypeScript では、`catch (err)` の `err` の型を何とも断定できません。

`strict: true`（に含まれる `useUnknownInCatchVariables`）では、`err` の型は **`unknown`** になります。`unknown` のままではプロパティにアクセスできないので、`instanceof` などで **型を絞り込んで（narrowing）** から使います。

## このプロジェクトでの実装

`web-app/src/hooks/useAddTransactions.ts:23`（`useIncomeTransactions.ts:21`、`useExpenseTransactions.ts:21` も同じ）

```ts
} catch (err) {
  setError(
    err instanceof Error ? err : new Error("不明なエラーが発生しました。"),
  );
  return false;
}
```

- `err` の型は `unknown`。
- `err instanceof Error` が `true` の分岐では、`err` は `Error` 型に絞り込まれるので、そのまま `setError(err)` に渡せます。
- `false` の分岐（`Error` 以外が投げられた場合）では、新しく `Error` を作って渡しています。
- 結果として、`setError` には必ず `Error` が渡り、state の型 `Error | null` と一致します。表示側では安心して `error.message` を使えます（`web-app/src/components/TransactionList.tsx:91`, `web-app/src/pages/Input.tsx:111`）。

この `catch` に来るのは、主に次の 2 種類です。

1. `fetch` 自体の失敗（ネットワークエラー、CORS エラーなど）→ ブラウザが `TypeError` を投げる（`TypeError` は `Error` のサブクラスなので `instanceof Error` は true）
2. `if (!response.ok) throw new Error("取引の登録に失敗しました。")`（`useAddTransactions.ts:19`）で自分で投げたもの

## 重要語句

| 用語 | 意味 |
| --- | --- |
| unknown | 「何かは分からない」型。何でも代入できるが、絞り込むまで何もできない（`any` の安全版） |
| any | 何でも代入でき、何でもできてしまう型。型チェックが無効になる |
| useUnknownInCatchVariables | catch 変数を `unknown` にする設定（TS 4.4〜）。`strict` に含まれる |
| narrowing（絞り込み） | 条件分岐などにより、ある範囲で変数の型をより具体的にすること |
| instanceof | 「オブジェクトがそのクラス（コンストラクタ）から作られたか」を調べる JavaScript の演算子。TypeScript はこれを型ガードとして扱う |

## 仕様・注意点

- `useUnknownInCatchVariables` が無効（または非 strict）だと `err` は `any` になり、`err.message` と書いても型エラーになりません。しかし実行時に `err` が文字列なら `undefined` になってしまいます。
- `catch (err: Error)` のように型注釈を付けることはできません（`any` か `unknown` のみ指定可能）。
- `instanceof` はクラス（コンストラクタ関数）でしか使えません。`type` や `interface` は実行時に存在しないので `x instanceof Transaction` とは書けません。
- `instanceof` は別の実行環境（iframe や別の realm）で作られたオブジェクトでは false になることがあります。そうした場面向けに新しい標準 API の `Error.isError()` があり、TypeScript 6.0 では `lib.esnext.error.d.ts` に `isError(error: unknown): error is Error` として型定義されています。ただし web-app は `lib: ["ES2023", "DOM"]` なので、そのままでは型として使えません（`lib` に `"ESNext"` 等を足す必要があり、実行ブラウザの対応も要確認）。
- `?:`（三項演算子）の中でも絞り込みは効きます。`if` 文に限りません。

## 今後に活かせるポイント

- catch したエラーを `Error` に正規化するパターンは、どのプロジェクトでも使えます。共通関数にしておくと便利です。

  ```ts
  export const toError = (e: unknown): Error =>
    e instanceof Error ? e : new Error(String(e));
  ```

- 外部から受け取る「型の分からない値」は `any` ではなく `unknown` で受けて、絞り込んでから使う習慣をつける（→ `17-any-propagation.md`）。
- 独自のエラークラスを作れば、`instanceof` でエラーの種類ごとに処理を分けられます。

## 改善するなら

3 つのフックに同じ catch 処理が重複しているので、共通化できます。また HTTP ステータスなどの情報を持たせたい場合は独自エラークラスが有効です。

```ts
// src/lib/errors.ts
export class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

export const toError = (e: unknown, fallback = "不明なエラーが発生しました。"): Error =>
  e instanceof Error ? e : new Error(fallback);
```

```ts
if (!response.ok) {
  throw new HttpError(response.status, "取引の登録に失敗しました。");
}
...
} catch (err) {
  setError(toError(err));
}
```

注意: web-app は `erasableSyntaxOnly: true` なので、`constructor(readonly status: number)` のような **パラメータプロパティは使えません**。上の例のようにフィールドを宣言して代入します（→ `22-tsconfig-verbatim-erasable.md`）。

## 次に学ぶこと

- 制御フロー解析による絞り込み全般 → `16-control-flow-narrowing.md`
- `Error` の `cause` オプション（`new Error("...", { cause: err })`、ES2022）で元のエラーを保持する
- Result 型で例外を使わずにエラーを表現する方法
