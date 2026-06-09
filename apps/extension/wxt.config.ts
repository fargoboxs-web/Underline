import { defineConfig } from "wxt";

export default defineConfig({
  srcDir: "src",
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "Underline",
    description:
      "Highlight confusing passages and ask AI to insert a bridge paragraph that teaches the missing background knowledge.",
    permissions: ["storage", "activeTab", "tabs"],
    host_permissions: ["http://*/*", "https://*/*"],
    options_page: "options.html",
    action: {
      default_title: "Underline"
    }
  }
});
