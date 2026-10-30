import type { HttpResponse } from "@/lib/cookie"

/** Decode only if a caller consumes the body; redirects often need headers alone. */
export function harmonyResponseBody(
  encoded: string,
  charset: string
): Pick<HttpResponse, "text" | "arrayBuffer"> {
  let bytes: Uint8Array<ArrayBuffer> | undefined
  let text: string | undefined
  const readBytes = (): Uint8Array<ArrayBuffer> => {
    if (!bytes) {
      if (typeof Uint8Array.fromBase64 === "function") {
        bytes = Uint8Array.fromBase64(encoded)
      } else {
        const binary = atob(encoded)
        bytes = new Uint8Array(binary.length)
        // Avoid Uint8Array.from(string, callback), which creates an intermediate
        // iterable and invokes a callback for every byte on older ArkWeb engines.
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      }
      encoded = ""
    }
    return bytes
  }
  return {
    text: async () => (text ??= new TextDecoder(charset).decode(readBytes())),
    arrayBuffer: async () => readBytes().buffer,
  }
}
