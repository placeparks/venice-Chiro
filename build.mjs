import { build, context } from "esbuild";
import fs from "node:fs";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const isWatch = process.argv.includes("--watch");

fs.mkdirSync("dist", { recursive: true });
fs.copyFileSync("spineai.html", "dist/index.html");

const buildOptions = {
  entryPoints: ["src/app.jsx"],
  bundle: true,
  minify: !isWatch,
  sourcemap: true,
  format: "iife",
  target: "es2018",
  outfile: "dist/app.js",
  define: {
    "process.env.NODE_ENV": JSON.stringify(isWatch ? "development" : "production"),
    "process.env.VENICE_API_KEY": JSON.stringify(process.env.VENICE_API_KEY || ""),
  },
};

if (isWatch) {
  const ctx = await context({
    ...buildOptions,
  });
  await ctx.watch();
  console.log("Watching for changes...");
  await ctx.wait();
} else {
  build(buildOptions).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

