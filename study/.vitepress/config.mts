import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { withMermaid } from "vitepress-plugin-mermaid";

// study/ 直下のフォルダ（= 学習カテゴリ）。表示順はここで決める。
const CATEGORIES = [
  "Architecture",
  "Hono",
  "API-Design",
  "React",
  "Routing",
  "ChakraUI",
  "TypeScript",
  "Tooling",
  "Database",
  "SQL",
  "PostgreSQL",
  "Docker",
];

const root = resolve(import.meta.dirname, "..");

// md の最初の `# 見出し` をタイトルとして使う
const readTitle = (file: string) => {
  const match = readFileSync(file, "utf8").match(/^#\s+(.+)$/m);
  return match ? match[1].replace(/`/g, "").trim() : file;
};

const buildSidebar = () =>
  CATEGORIES.filter((dir) => statSync(join(root, dir), { throwIfNoEntry: false })?.isDirectory()).map(
    (dir) => {
      const notes = readdirSync(join(root, dir))
        .filter((f) => f.endsWith(".md") && f !== "README.md")
        .sort();
      return {
        text: dir,
        collapsed: true,
        link: `/${dir}/`,
        items: notes.map((f) => ({
          text: readTitle(join(root, dir, f)),
          link: `/${dir}/${f.replace(/\.md$/, "")}`,
        })),
      };
    },
  );

export default withMermaid({
  // web-app と一緒に公開するときは /study/ 配下に置く（web-app の build:study が STUDY_BASE を渡す）。
  // ローカルの npm run docs では / のまま。
  base: process.env.STUDY_BASE ?? "/",
  lang: "ja-JP",
  title: "kakeibo-app 学習ノート",
  description: "家計簿アプリから学んだことのまとめ",
  // 各フォルダの README.md をフォルダのトップページ（index）として扱う
  rewrites: {
    ":dir/README.md": ":dir/index.md",
  },
  srcExclude: ["node_modules/**"],
  // ノート内にはプロジェクトのソースファイルへの相対リンクがあるため、リンク切れでビルドを止めない
  ignoreDeadLinks: true,
  lastUpdated: false,
  vite: {
    // mermaid 11 は es-toolkit の細かいファイルを大量に読み込むため、
    // 開発サーバーで事前バンドルしないと数百のリクエストで画面が表示されなくなる
    optimizeDeps: { include: ["mermaid"] },
  },
  markdown: {
    languageAlias: { gitignore: "ini" },
    config(md) {
      // ノートは純粋な Markdown として書かれているので、
      // 本文中の <Box> などの HTML タグはタグとして解釈せず文字として表示する
      md.set({ html: false });
      // 本文・インラインコード中の `{{ ... }}` を Vue の埋め込み式として解釈させない
      const escapeMustache = (html: string) =>
        html.replace(/\{\{/g, "&#123;&#123;").replace(/\}\}/g, "&#125;&#125;");
      for (const rule of ["text", "code_inline"] as const) {
        const original = md.renderer.rules[rule]!;
        md.renderer.rules[rule] = (tokens, idx, options, env, self) =>
          escapeMustache(original(tokens, idx, options, env, self));
      }
    },
  },
  themeConfig: {
    nav: [{ text: "トップ", link: "/" }],
    sidebar: buildSidebar(),
    outline: { level: [2, 3], label: "このページの目次" },
    search: { provider: "local" },
    docFooter: { prev: "前のノート", next: "次のノート" },
    darkModeSwitchLabel: "テーマ",
    returnToTopLabel: "トップへ戻る",
    sidebarMenuLabel: "メニュー",
  },
});
