import { afterEach, describe, expect, it, vi } from "vitest"
import { harmonyResponseBody } from "./harmony-response"

const decoderDescriptor = Object.getOwnPropertyDescriptor(Uint8Array, "fromBase64")
afterEach(() => {
  vi.restoreAllMocks()
  if (decoderDescriptor) Object.defineProperty(Uint8Array, "fromBase64", decoderDescriptor)
  else Reflect.deleteProperty(Uint8Array, "fromBase64")
})

describe("Harmony response body", () => {
  it.each([false, true])(
    "preserves Unicode and binary data (native decoder: %s)",
    async (native) => {
      const decode = vi.fn((input: string) => new Uint8Array(Buffer.from(input, "base64")))
      Object.defineProperty(Uint8Array, "fromBase64", {
        configurable: true,
        value: native ? decode : undefined,
      })
      const source = Buffer.from("燕大终端\u0000😀\n")
      const response = harmonyResponseBody(source.toString("base64"), "utf-8")
      expect(decode).not.toHaveBeenCalled()
      expect(await response.text()).toBe(source.toString("utf-8"))
      expect(Buffer.from(await response.arrayBuffer())).toEqual(source)
      expect(await response.text()).toBe(source.toString("utf-8"))
      if (native) expect(decode).toHaveBeenCalledTimes(1)

      const allBytes = Uint8Array.from({ length: 256 * 1024 }, (_, i) => i % 256)
      const binary = harmonyResponseBody(Buffer.from(allBytes).toString("base64"), "utf-8")
      expect(new Uint8Array(await binary.arrayBuffer())).toEqual(allBytes)
    }
  )

  it("decodes text only when consumed and reuses it on subsequent reads", async () => {
    const decode = vi.spyOn(TextDecoder.prototype, "decode")
    const response = harmonyResponseBody(Buffer.from([0xd6, 0xd0]).toString("base64"), "gbk")
    expect(decode).not.toHaveBeenCalled()
    expect(await response.text()).toBe("中")
    expect(await response.text()).toBe("中")
    expect(decode).toHaveBeenCalledTimes(1)
  })

  it("handles empty redirects and rejects malformed data only when consumed", async () => {
    const response = harmonyResponseBody("", "utf-8")
    expect(await response.text()).toBe("")
    expect((await response.arrayBuffer()).byteLength).toBe(0)
    const malformed = harmonyResponseBody("%%%", "utf-8")
    await expect(malformed.arrayBuffer()).rejects.toThrow()
  })
})
