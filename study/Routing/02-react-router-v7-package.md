# React Router v7 のパッケージ統合（react-router-dom → react-router）

## 概要

React Router v6 までは、Web アプリでは `react-router-dom` をインストールして使うのが定番でした。**v7 ではパッケージが整理され、`react-router` 1 つから全部 import できる** ようになりました。

インストール済みの `web-app/node_modules/react-router/CHANGELOG.md` の v7.0.0 の項には次のように書かれています。

> - Collapse `@remix-run/router` into `react-router`
> - Collapse `react-router-dom` into `react-router`
> - Collapse `@remix-run/server-runtime` into `react-router`
> - Collapse `@remix-run/testing` into `react-router`

また、アップグレードガイド（`node_modules/react-router/docs/upgrading/v6.md`）にも

> In v7 we no longer need `"react-router-dom"` as the packages have been simplified. You can import everything from `"react-router"`
>
> Note you only need `"react-router"` in your package.json.

とあります。React Router v7 は Remix v2 の後継も兼ねており、Remix 系パッケージも `react-router` に統合されています。

## このプロジェクトでの実装

`web-app/package.json` の dependencies には `react-router` だけがあり、`react-router-dom` はありません。

```json
// web-app/package.json（dependencies より抜粋）
"react-router": "^7.18.4"
```

実際にインストールされているバージョンは `node_modules/react-router/package.json` で `7.18.4` です（`node_modules/react-router-dom` は存在しません）。

import もすべて `"react-router"` からです。

```tsx
// web-app/src/App.tsx:1
import { BrowserRouter, Route, Routes } from "react-router";
```

```tsx
// web-app/src/pages/Home.tsx:17
import { useNavigate } from "react-router";
```

```tsx
// web-app/src/pages/Input.tsx:15
import { useNavigate } from "react-router";
```

## 重要語句

- **react-router**: v7 のメインパッケージ。`BrowserRouter`, `Routes`, `Route`, `Link`, `NavLink`, `useNavigate` などをすべて提供する。
- **react-router-dom**: v6 までの Web 向けパッケージ。v7 では不要（互換のために v7 版も公開されているが、新規プロジェクトでは使わない）。
- **react-router/dom**: DOM（`react-dom`）に依存する一部 API 用のサブパス。アップグレードガイドでは `RouterProvider` と `HydratedRouter` をここから import する例が示されている（Data / Framework モードで使うもの）。
- **^7.18.4（キャレット）**: 「7.x.x の範囲で 7.18.4 以上」を許す semver 指定。

## 仕様・注意点

- ネット上の記事やサンプルの多くは v6 時代のもので、`import { ... } from "react-router-dom"` と書かれています。**このプロジェクトでは `react-router` に読み替える** 必要があります。API 名（`BrowserRouter`, `useNavigate` など）は v6 とほぼ同じです。
- v7 の `react-router-dom` は中身が `export * from "react-router"` の再エクスポートで、依存する `react-router` のバージョンを完全一致で固定しています。そのため両方入っていても同じバージョンなら 1 つにまとめられ問題になりませんが、**バージョンが食い違って `react-router` が 2 重にインストールされる** と、ルーターのコンテキストが別インスタンスになり「`useNavigate() may be used only in the context of a <Router> component.`」のようなエラーの原因になり得ます（実装コード内にも「2 つのバージョンが読み込まれている可能性」を示唆するコメントがあります）。新規なら `react-router` だけに統一しましょう。
- v5 → v6 では API が大きく変わりました（`Switch` → `Routes`、`component` → `element`、`useHistory` → `useNavigate` など）。v5 の記事は特に注意して読みます。

## 今後に活かせるポイント

- ライブラリを調べるときは、**インストール済みのバージョン** を `package.json` と `node_modules/<pkg>/package.json` で確認し、同梱の `CHANGELOG.md` や `docs/` を一次情報として読む習慣をつけると、古い記事に惑わされにくくなります。
- v6 から移行する場合は、`docs/upgrading/v6.md` にある future flag を順に有効化してから v7 に上げるのが公式の推奨手順です。

## 次に学ぶこと

- v7 の future flags（`v7_startTransition`, `v7_relativeSplatPath` など、v6 時点で v7 の挙動を先取りする仕組み）。
- Remix v2 → React Router v7 の移行（`docs/upgrading/remix.md`）。
