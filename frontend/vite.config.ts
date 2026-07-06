import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Relative base ("./") means the built site works no matter what your GitHub
// Pages repo is called (yourname.github.io/whatever/) without extra config.
export default defineConfig({
  base: "./",
  plugins: [react()],
});
