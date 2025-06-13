const fs = require("fs");
const path = require("path");
const { minify } = require("terser");

async function buildEmbed() {
  try {
    console.log("Building embed script...");

    // Read your source script
    const sourceScript = fs.readFileSync(
      path.join(__dirname, "embed.js"),
      "utf8"
    );

    // Minify and obfuscate
    const result = await minify(sourceScript, {
      compress: {
        drop_console: process.env.NODE_ENV === "production",
        drop_debugger: true,
        pure_funcs: ["console.log", "console.warn"],
        passes: 2,
      },
      mangle: {
        toplevel: true,
      },
      format: {
        comments: false,
      },
    });

    if (result.error) {
      console.error("Minification error:", result.error);
      process.exit(1);
    }

    // Ensure public directory exists
    const publicDir = path.join(__dirname, "../public");
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }

    // Write minified script to public directory
    const outputPath = path.join(publicDir, "embed.min.js");
    fs.writeFileSync(outputPath, result.code);

    // Also create a versioned file
    // const version = require("package.json").version || "1.0.0";
    // const versionedPath = path.join(publicDir, `embed-${version}.min.js`);
    // fs.writeFileSync(versionedPath, result.code);

    console.log(`✅ Embed script built successfully!`);
    console.log(`📁 Output: ${outputPath}`);
    // console.log(`📁 Versioned: ${versionedPath}`);
    console.log(`📊 Original size: ${sourceScript.length} bytes`);
    console.log(`📊 Minified size: ${result.code.length} bytes`);
    console.log(
      `🎯 Compression: ${Math.round(
        (1 - result.code.length / sourceScript.length) * 100
      )}%`
    );
  } catch (error) {
    console.error("❌ Build failed:", error);
    process.exit(1);
  }
}

buildEmbed();
