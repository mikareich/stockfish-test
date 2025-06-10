Bun.serve({
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    const headers = new Headers();

    headers.set("Cross-Origin-Embedder-Policy", "require-corp");
    headers.set("Cross-Origin-Opener-Policy", "same-origin");

    console.log(path);

    if (path === "/") {
      const file = Bun.file("./index.html");
      const content = await file.text();
      headers.set("Content-Type", "text/html");

      return new Response(content, {
        headers,
      });
    } else if (path === "/sf171-79.js") {
      const file = Bun.file("./sf171-79.js");
      const content = await file.text();
      headers.set("Content-Type", "text/javascript");

      return new Response(content, {
        headers,
      });
    } else if (path === "/sf171-79.wasm") {
      const file = Bun.file("./sf171-79.wasm");
      const content = await file.text();
      headers.set("Content-Type", "application/wasm");

      return new Response(content, {
        headers,
      });
    }

    return new Response("", {
      headers,
    });
  },
  port: 3000,
});
