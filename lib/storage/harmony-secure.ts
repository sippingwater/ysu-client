import { harmonyCall } from "@/lib/native/harmony"
import type { DataType } from "@aparajita/capacitor-secure-storage"

// Share only the latest identical write while it is still in flight. Completed
// writes are not cached, so failures and device-lock checks remain retryable.
const pendingWrites = new Map<string, { value: string; promise: Promise<void> }>()

/** Asset Store Kit only. Errors propagate; there is deliberately no web fallback. */
export const HarmonySecureStorage = {
  async getItem(key: string): Promise<string | null> {
    const result = await harmonyCall<{ value: string | null }>("secure.get", { key })
    return result.value
  },
  async setItem(key: string, value: string): Promise<void> {
    const pending = pendingWrites.get(key)
    if (pending?.value === value) return pending.promise
    const promise = harmonyCall<void>("secure.set", { key, value }).finally(() => {
      if (pendingWrites.get(key)?.promise === promise) pendingWrites.delete(key)
    })
    pendingWrites.set(key, { value, promise })
    return promise
  },
  async removeItem(key: string): Promise<void> {
    pendingWrites.delete(key)
    await harmonyCall("secure.remove", { key })
  },
  async get(key: string): Promise<DataType | null> {
    const value = await this.getItem(key)
    return value === null ? null : JSON.parse(value)
  },
  async set(key: string, value: DataType): Promise<void> {
    await this.setItem(key, JSON.stringify(value))
  },
  async remove(key: string): Promise<void> {
    await this.removeItem(key)
  },
}
