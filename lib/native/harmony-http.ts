import {
  splitSetCookie,
  type HttpRequest,
  type HttpResponse,
  type SimpleCookieJar,
} from "@/lib/cookie"
import { getCustomUserAgent } from "@/lib/custom-user-agent"
import { harmonyCall } from "./harmony"
import { assertHarmonyRequest } from "./harmony-policy"
import { harmonyResponseBody } from "./harmony-response"

interface NativeResponse {
  status: number
  headers: Record<string, string | string[]>
  bodyBase64: string
}

// A feed can mount dozens of images together; leave native slots for auth and storage.
const httpWaiters: Array<() => void> = []
let activeHttp = 0
async function withHttpSlot<T>(send: () => Promise<T>): Promise<T> {
  if (activeHttp >= 6) await new Promise<void>((resolve) => httpWaiters.push(resolve))
  else activeHttp++
  try {
    return await send()
  } finally {
    const next = httpWaiters.shift()
    if (next) next()
    else activeHttp--
  }
}

export async function harmonyHttpSend(
  jar: SimpleCookieJar,
  req: HttpRequest
): Promise<HttpResponse> {
  assertHarmonyRequest(req.method, req.url, req.body?.toString())
  if (req.signal?.aborted) throw new DOMException("The operation was aborted.", "AbortError")
  const parsed = new URL(req.url)
  parsed.hash = ""
  const headers: Record<string, string> = {}
  for (const [key, value] of Object.entries(req.headers ?? {})) {
    if (key.toLowerCase() !== "cookie") headers[key.toLowerCase()] = value
  }
  headers["user-agent"] ||= getCustomUserAgent()
  headers["accept"] ||= "text/html,application/json,*/*"
  headers["accept-language"] ||= "zh-CN,zh;q=0.9,en;q=0.8"
  const cookies = await jar.getCookieString(parsed.toString())
  if (cookies) headers.cookie = cookies
  const response = await withHttpSlot(() => {
    if (req.signal?.aborted) throw new DOMException("The operation was aborted.", "AbortError")
    return harmonyCall<NativeResponse>("http.request", {
      method: req.method,
      url: parsed.toString(),
      headers,
      body: req.body?.toString(),
      timeoutMs: Math.min(req.timeoutMs ?? 30_000, 60_000),
    })
  })
  if (req.signal?.aborted) throw new DOMException("The operation was aborted.", "AbortError")
  const normalized: Record<string, string | string[]> = {}
  for (const [key, value] of Object.entries(response.headers)) normalized[key.toLowerCase()] = value
  const setCookies = normalized["set-cookie"]
  // The native bridge preserves individual Set-Cookie values, including Expires commas.
  if (setCookies) {
    for (const cookie of Array.isArray(setCookies) ? setCookies : splitSetCookie(setCookies)) {
      await jar.setCookie(cookie, parsed.toString(), { ignoreError: true })
    }
  }
  const contentType = normalized["content-type"]
  const type = Array.isArray(contentType) ? contentType[0] : contentType
  const charset = type?.match(/charset=["']?([^\s;"']+)/i)?.[1] || "utf-8"
  return {
    status: response.status,
    url: parsed.toString(),
    headers: normalized,
    ...harmonyResponseBody(response.bodyBase64, charset),
  }
}
