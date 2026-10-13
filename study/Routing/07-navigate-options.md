# navigate のオプション（replace / state / -1 で戻る）

## 概要

`navigate(to, options)` の第 2 引数で遷移の仕方を細かく指定できます。また `navigate(-1)` のように **数値** を渡すと履歴を前後に移動できます。

`NavigateOptions` の型（`node_modules/react-router/dist/development/index-react-server-client-*.d.ts`）と JSDoc によると、オプションは **モードによって使えるものが違います**。

| オプション | 意味 | Declarative で使える？ |
| --- | --- | --- |
| `replace` | 履歴に積まず、現在のエントリを置き換える | ✅ |
| `state` | 次の location に任意のデータを添える（`useLocation().state` で読む） | ✅ |
| `relative` | `"route"` / `"path"` で相対パスの解決方法を切り替える | ✅ |
| `preventScrollReset` | `<ScrollRestoration>` のスクロール位置リセットを防ぐ | ❌（Data / Framework のみ） |
| `flushSync` | 状態更新を `ReactDOM.flushSync` で包む | ❌（Data / Framework のみ） |
| `viewTransition` | View Transitions API を使ったアニメーション | ❌（Data / Framework のみ） |

### replace の動き（履歴スタックのイメージ）

```
push（既定）: navigate("/")
  [ / ] → [ /, /input ] → [ /, /input, / ]     ← 戻るを押すと /input に戻る

replace: navigate("/", { replace: true })
  [ / ] → [ /, /input ] → [ /, / ]             ← /input が / に置き換わる
```

JSDoc ではこれを「サーバーサイドリダイレクトに似ている」と説明しています。内部的には `replace` が真なら `navigator.replace`（= `history.replaceState`）、そうでなければ `navigator.push`（= `history.pushState`）が呼ばれます。

### 数値（delta）で戻る・進む

```tsx
navigate(-1); // 1 つ戻る（ブラウザの「戻る」と同じ）
navigate(1);  // 1 つ進む
```

内部では `navigator.go(delta)`（= `history.go`）が呼ばれます。

## このプロジェクトでの実装

このプロジェクトでは **オプションを一切使っていません**。すべて push（既定）です。

```tsx
// web-app/src/pages/Home.tsx:31
onClick={() => navigate("/input")}

// web-app/src/pages/Input.tsx:44-46（登録成功後）
if (ok) {
  navigate("/");
}

// web-app/src/pages/Input.tsx:49-51（キャンセル）
const onCancel = () => {
  navigate("/");
};
```

その結果、次のような履歴になります。

```
ホームを開く         [ / ]
「登録」を押す       [ /, /input ]
登録成功             [ /, /input, / ]
ブラウザの「戻る」   → /input（空のフォーム）が表示される
```

登録が終わったのに「戻る」で入力画面が再び出てくるのは、少し違和感のある挙動です（データが二重登録されるわけではなく、入力欄は空の状態で表示されます。`Input` が再マウントされ `useState("")` から始まるため）。

## 重要語句

- **push**: 履歴スタックに新しいエントリを追加する遷移（既定）。
- **replace**: 現在のエントリを新しいもので置き換える遷移。
- **delta**: 履歴を何個分移動するかを表す数値。負なら戻る、正なら進む。
- **location.state**: URL には現れないが履歴エントリに紐づくデータ。`useLocation().state` で取得する。

## 仕様・注意点

- **`navigate(-1)` は「必ずアプリ内の前の画面に戻る」とは限りません**。JSDoc にも「戻る/進む先の履歴エントリがない場合や、予期しない場所（別ドメインなど）に行く可能性がある」と注意書きがあります。例えば、ユーザーがブックマークから `/input` を直接開いた場合、`navigate(-1)` は **このアプリの外（直前に見ていたサイト）** に戻ってしまいます。このプロジェクトのキャンセルが `navigate("/")` なのは、その意味で安全な選択です。
- `state` は URL に含まれないため、**URL をコピーして別タブで開くと失われます**。共有したい情報は URL（パスやクエリ）に入れましょう。また `state` は `history.state` に保存されるので、シリアライズ可能な値（関数などは不可）にします。
- `<Link>` は、**現在と同じ URL へのリンク** をクリックしたとき、`replace` を指定していなければ自動で replace 扱いになります（`useLinkClickHandler` の実装より）。同じ画面を何度クリックしても履歴が増えないための配慮です。`navigate()` を直接呼ぶ場合はこの自動判定はありません。

## 今後に活かせるポイント

- **「処理完了後の遷移」には `replace: true`** を使うと、戻るボタンで完了済みの画面に戻ってしまう問題を避けられます。ログイン後のリダイレクト、決済完了後の遷移などでよく使います。
- 「戻る」ボタンを自作するなら、`navigate(-1)` の手軽さと、直接アクセス時に外部へ出てしまうリスクを天秤にかけます。迷ったら明示的なパス（`navigate("/")`）が安全です。

## 改善するなら

### 登録成功後は replace で遷移する

```tsx
// web-app/src/pages/Input.tsx（改善例）
if (ok) {
  navigate("/", { replace: true });
}
```

```
ホームを開く         [ / ]
「登録」を押す       [ /, /input ]
登録成功（replace）  [ /, / ]
ブラウザの「戻る」   → /（最初のホーム）
```

### state で「登録しました」を伝える

遷移先で完了メッセージ（トーストなど）を出したい場合、`state` を使えます。

```tsx
// Input.tsx
navigate("/", { replace: true, state: { added: item } });

// Home.tsx
import { useLocation } from "react-router";

const location = useLocation();
const added = (location.state as { added?: string } | null)?.added;
// added があれば「◯◯を登録しました」と表示する
```

※ `state` は履歴エントリに残るため、リロードしても同じ値が残る点に注意（一度だけ表示したいなら表示後に `navigate(location.pathname, { replace: true, state: null })` などで消す工夫が必要）。

## 次に学ぶこと

- `useLocation` と `useNavigationType`（直前の遷移が PUSH / REPLACE / POP のどれかを知る）
- `useSearchParams`（URL のクエリ `?type=expense` を状態として扱う。Declarative モードでも使える）
- Data モードでの `preventScrollReset` / `viewTransition`
