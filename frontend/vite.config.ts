import path from "node:path";
import * as ts from "typescript";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin } from "vite";

function sectionTextLocalization(): Plugin {
  const ignoredTags = new Set(["code", "pre", "script", "style", "svg", "textarea"]);

  return {
    name: "section-text-localization",
    enforce: "pre",
    transform(code, id) {
      const filePath = id.split("?")[0];
      if (!/\.[jt]sx$/.test(filePath) || filePath.includes("/node_modules/")) return null;

      const source = ts.createSourceFile(filePath, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const edits: { start: number; end: number; text: string }[] = [];

      const hasIgnoredAncestor = (node: ts.Node) => {
        let current: ts.Node | undefined = node.parent;
        while (current && !ts.isSourceFile(current)) {
          if (ts.isJsxElement(current) || ts.isJsxSelfClosingElement(current)) {
            const openingElement = ts.isJsxElement(current) ? current.openingElement : current;
            const tagName = openingElement.tagName.getText(source).toLowerCase();
            if (ignoredTags.has(tagName)) return true;
            if (openingElement.attributes.properties.some((attribute) =>
              ts.isJsxAttribute(attribute)
              && attribute.name.getText(source) === "data-no-translate"
            )) return true;
          }
          current = current.parent;
        }
        return false;
      };

      const isRenderedString = (node: ts.StringLiteralLike) => {
        let current: ts.Node | undefined = node.parent;
        while (current) {
          if (ts.isJsxAttribute(current)) return false;
          if (ts.isJsxExpression(current)) {
            return ts.isJsxElement(current.parent) || ts.isJsxFragment(current.parent);
          }
          current = current.parent;
        }
        return false;
      };

      const visit = (node: ts.Node) => {
        if (!hasIgnoredAncestor(node)) {
          if (ts.isJsxText(node) && node.text.trim()) {
            edits.push({
              start: node.getStart(source),
              end: node.end,
              text: `{translateTextForCurrentSection(${JSON.stringify(node.text)})}`,
            });
          } else if (ts.isStringLiteral(node) && isRenderedString(node)) {
            edits.push({
              start: node.getStart(source),
              end: node.end,
              text: `translateTextForCurrentSection(${JSON.stringify(node.text)})`,
            });
          }
        }
        ts.forEachChild(node, visit);
      };

      visit(source);
      if (!edits.length) return null;

      let transformed = code;
      edits.sort((first, second) => second.start - first.start);
      for (const edit of edits) {
        transformed = `${transformed.slice(0, edit.start)}${edit.text}${transformed.slice(edit.end)}`;
      }
      return {
        code: `import { translateTextForCurrentSection } from "@/lib/language";\n${transformed}`,
        map: null,
      };
    },
  };
}

export default defineConfig({
  plugins: [sectionTextLocalization(), react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
