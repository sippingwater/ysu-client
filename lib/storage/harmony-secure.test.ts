import { beforeEach, describe, expect, it, vi } from "vitest"

const bridge = vi.hoisted(() => ({ call: vi.fn() }))
vi.mock("@/lib/native/harmony", () => ({ harmonyCall: bridge.call }))
import { HarmonySecureStorage } from "./harmony-secure"

function deferred() {
  let resolve!: () => void
  let reject!: (reason: Error) => void
  const promise = new Promise<void>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

beforeEach(() => bridge.call.mockReset())

describe("Harmony concurrent credential saves", () => {
  it("shares identical concurrent saves without caching completed writes", async () => {
    const pending = deferred()
    bridge.call.mockReturnValue(pending.promise)
    const saves = Array.from({ length: 20 }, () => HarmonySecureStorage.setItem("auth", "same"))
    expect(bridge.call).toHaveBeenCalledTimes(1)
    pending.resolve()
    await Promise.all(saves)
    await HarmonySecureStorage.setItem("auth", "same")
    expect(bridge.call).toHaveBeenCalledTimes(2)
  })

  it("preserves different values, different keys and writes after removal in order", async () => {
    const pending = deferred()
    bridge.call.mockReturnValue(pending.promise)
    const actions = [
      HarmonySecureStorage.setItem("auth", "one"),
      HarmonySecureStorage.setItem("auth", "two"),
      HarmonySecureStorage.setItem("auth", "one"),
      HarmonySecureStorage.setItem("token", "one"),
      HarmonySecureStorage.removeItem("auth"),
      HarmonySecureStorage.setItem("auth", "one"),
    ]
    expect(bridge.call.mock.calls).toEqual([
      ["secure.set", { key: "auth", value: "one" }],
      ["secure.set", { key: "auth", value: "two" }],
      ["secure.set", { key: "auth", value: "one" }],
      ["secure.set", { key: "token", value: "one" }],
      ["secure.remove", { key: "auth" }],
      ["secure.set", { key: "auth", value: "one" }],
    ])
    pending.resolve()
    await Promise.all(actions)
  })

  it("reports a failed save to all callers and retries the next save", async () => {
    const pending = deferred()
    bridge.call.mockReturnValue(pending.promise)
    const first = HarmonySecureStorage.setItem("auth", "same")
    const second = HarmonySecureStorage.setItem("auth", "same")
    const results = Promise.allSettled([first, second])
    pending.reject(new Error("device locked"))
    expect((await results).map((result) => result.status)).toEqual(["rejected", "rejected"])
    bridge.call.mockResolvedValue(undefined)
    await HarmonySecureStorage.setItem("auth", "same")
    expect(bridge.call).toHaveBeenCalledTimes(2)
  })
})
