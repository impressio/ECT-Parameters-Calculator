const wasmUrl = new URL('ect_markdown.wasm', import.meta.url);
let ready;
export async function loadRenderer() {
  ready ||= (async () => {
    const response = await fetch(wasmUrl);
    if (!response.ok) throw new Error('WebAssembly-modulen kunde inte laddas.');
    let result;
    try { result = await WebAssembly.instantiateStreaming(response.clone(), {}); }
    catch { result = await WebAssembly.instantiate(await response.arrayBuffer(), {}); }
    return result.instance.exports;
  })().catch(error => { ready = undefined; throw error; });
  const wasm = await ready;
  const encoder = new TextEncoder(), decoder = new TextDecoder();
  return request => {
    const input = encoder.encode(JSON.stringify(request));
    if (input.length > 2_000_000) throw new Error('Kapitlet är för stort.');
    const pointer = wasm.alloc(input.length);
    let outPointer = 0, outLength = 0;
    try {
      new Uint8Array(wasm.memory.buffer, pointer, input.length).set(input);
      const packed = BigInt.asUintN(64, wasm.render_json(pointer, input.length));
      outPointer = Number(packed >> 32n); outLength = Number(packed & 0xffffffffn);
      const result = JSON.parse(decoder.decode(new Uint8Array(wasm.memory.buffer, outPointer, outLength)));
      if (result.error) throw new Error(result.error);
      return result.html;
    } finally {
      wasm.dealloc(pointer, input.length);
      if (outLength) wasm.dealloc(outPointer, outLength);
    }
  };
}
