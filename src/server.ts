import { join, resolve } from "node:path";

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = resolve(process.cwd(), "public");
const SRC_DIR = resolve(process.cwd(), "src");

console.log(`Serving on http://localhost:${PORT}`);

Bun.serve({
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    const headers = new Headers();
    headers.set("Cross-Origin-Embedder-Policy", "require-corp");
    headers.set("Cross-Origin-Opener-Policy", "same-origin");
    headers.set("Cross-Origin-Resource-Policy", "cross-origin");

    // serves `index.html` on `/`
    if (path === "/") {
      const file = Bun.file(resolve(PUBLIC_DIR, "index.html"));
      const content = await file.text();
      headers.set("Content-Type", "text/html");

      return new Response(content, {
        headers,
      });
    }
    // serves bundled and compiled js file
    else if (path === "/main.js") {
      try {
        const output = await Bun.build({
          entrypoints: [join(SRC_DIR, "client", "index.tsx")],
          minify: true,
          sourcemap: "none",
        });

        if (!output.success) throw new Error();

        let build = "";
        for await (const chunk of output.outputs) build += await chunk.text();

        return new Response(build, {
          headers: { "Content-Type": "application/javascript" },
        });
      } catch {
        console.error("Could not serve js build :o");
      }
    }
    // serve assets from `PUBLIC_DIR`
    else {
      const file = Bun.file(join(PUBLIC_DIR, path));
      const fileExists = await file.exists();

      if (fileExists) {
        // Set correct MIME type for WASM files
        if (path.endsWith('.wasm')) {
          headers.set("Content-Type", "application/wasm");
          const arrayBuffer = await file.arrayBuffer();
          return new Response(arrayBuffer, { headers });
        } else if (path.endsWith('.js')) {
          headers.set("Content-Type", "application/javascript");
        } else {
          headers.set("Content-Type", file.type);
        }

        const content = await file.text();
        return new Response(content, { headers });
      }
    }

    return new Response("Not found.", {
      headers,
      status: 400,
    });
  },
  port: PORT,
});
