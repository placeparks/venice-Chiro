import { build, context } from "esbuild";
import fs from "node:fs";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const isWatch = process.argv.includes("--watch");

fs.mkdirSync("dist", { recursive: true });
fs.copyFileSync("spineai.html", "dist/index.html");

// Copy service worker for offline functionality
if (fs.existsSync("public/sw.js")) {
  fs.copyFileSync("public/sw.js", "dist/sw.js");
  console.log("Copied service worker to dist/sw.js");
}

const buildOptions = {
  entryPoints: ["src/app.jsx"],
  bundle: true,
  minify: !isWatch,
  sourcemap: isWatch, // Only generate sourcemaps in dev mode
  format: "iife",
  target: "es2018",
  outfile: "dist/app.js",
  treeShaking: true,
  drop: isWatch ? [] : ["console", "debugger"], // Remove console.log in production
  define: {
    "process.env.NODE_ENV": JSON.stringify(isWatch ? "development" : "production"),
    "process.env.VENICE_API_KEY": JSON.stringify(process.env.VENICE_API_KEY || ""),
  },
  metafile: true, // Generate build metadata for size analysis
};

if (isWatch) {
  const ctx = await context({
    ...buildOptions,
  });
  await ctx.watch();
  console.log("Watching for changes...");
  await ctx.wait();
} else {
  build(buildOptions).then((result) => {
    // Report bundle size
    const outputs = result.metafile.outputs;
    for (const [file, info] of Object.entries(outputs)) {
      const sizeKB = (info.bytes / 1024).toFixed(2);
      console.log(`✓ ${file}: ${sizeKB} KB`);
    }
    console.log("\n✅ Production build complete!");
  }).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

