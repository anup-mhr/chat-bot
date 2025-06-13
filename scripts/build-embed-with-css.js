// scripts/build-embed-with-css.js - Enhanced build script
const fs = require("fs");
const path = require("path");
const { minify } = require("terser");

async function minifyCSS(css) {
  try {
    // Try advanced CSS minification
    const postcss = require("postcss");
    const cssnano = require("cssnano");

    const result = await postcss([
      cssnano({
        preset: [
          "default",
          {
            discardComments: { removeAll: true },
            normalizeWhitespace: true,
            mergeLonghand: true,
            mergeRules: true,
            minifySelectors: true,
            colormin: true,
            convertValues: true,
            discardDuplicates: true,
            discardEmpty: true,
            minifyParams: true,
            reduceIdents: false,
          },
        ],
      }),
    ]).process(css, { from: undefined });

    return result.css;
  } catch (error) {
    console.warn("Using basic CSS minification");
    // Fallback to basic minification
    return css
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\s+/g, " ")
      .replace(/\s*([{}:;,>+~])\s*/g, "$1")
      .replace(/;}/g, "}")
      .trim();
  }
}

async function buildEmbedWithCSS() {
  try {
    console.log("🎨 Building embed script with separate CSS optimization...");

    // Read CSS file
    const cssPath = path.join(__dirname, "../styles/embed-styles.css");
    const cssContent = fs.readFileSync(cssPath, "utf8");
    const minifiedCSS = await minifyCSS(cssContent);

    // Read JS file
    let jsContent = fs.readFileSync(path.join(__dirname, "embed.js"), "utf8");

    const cssInjection = `
(function renderStyles() {
  const style = document.createElement("style");
  style.innerHTML = \`${minifiedCSS}\`;
  document.head.appendChild(style);
})();
`;

    const injectedJS = `${cssInjection}\n${jsContent}`;

    // Minify the complete script
    const result = await minify(injectedJS, {
      compress: {
        drop_console: process.env.NODE_ENV === "production",
        drop_debugger: true,
        pure_funcs: ["console.log"],
        passes: 3,
      },
      mangle: { toplevel: true },
      format: { comments: false },
    });

    if (result.error) {
      console.error("❌ Minification error:", result.error);
      process.exit(1);
    }

    // Write output
    const publicDir = path.join(__dirname, "../public");
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }

    fs.writeFileSync(path.join(publicDir, "embed.min.js"), result.code);

    console.log("✅ Build completed with optimized CSS!");
    console.log(`📊 CSS: ${cssContent.length} → ${minifiedCSS.length} bytes`);
    console.log(`📊 Total: ${formatBytes(result.code.length)}`);
  } catch (error) {
    console.error("❌ Build failed:", error);
    process.exit(1);
  }
}

function formatBytes(bytes) {
  const sizes = ["Bytes", "KB", "MB"];
  if (bytes === 0) return "0 Bytes";
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + " " + sizes[i];
}

buildEmbedWithCSS();
