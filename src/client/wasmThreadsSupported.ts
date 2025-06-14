export default function wasmThreadsSupported() {
  // WebAssembly 1.0
  const source = Uint8Array.of(0x0, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00);
  if (
    typeof WebAssembly !== "object" ||
    typeof WebAssembly.validate !== "function"
  )
    return false;
  if (!WebAssembly.validate(source)) return false;

  // SharedArrayBuffer
  if (typeof SharedArrayBuffer !== "function") return false;

  // Atomics
  if (typeof Atomics !== "object") return false;

  // Shared memory
  const mem = new WebAssembly.Memory({ shared: true, initial: 8, maximum: 16 });
  if (!(mem.buffer instanceof SharedArrayBuffer)) return false;

  // Structured cloning
  try {
    window.postMessage(mem, "*");
  } catch (e) {
    console.log(`Browser Error ${e}`);
    return false;
  }

  // Growable shared memory (optional)
  try {
    mem.grow(8);
  } catch (e) {
    console.log(`Browser Error ${e}`);
    return false;
  }

  return true;
}
