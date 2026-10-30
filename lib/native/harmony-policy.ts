import policy from "../../harmony/security-policy.json"

export function assertHarmonyRequest(
  method: string,
  input: string,
  body?: string,
  depth = 0
): void {
  if (depth > 3 || input.length > 8192) throw new Error("安全策略禁止此请求")
  const parsed = new URL(input)
  if (parsed.username || parsed.password || parsed.port || /[%\\]/.test(parsed.pathname)) {
    throw new Error("安全策略禁止此请求")
  }
  const schoolOrigin =
    /^(https:\/\/(cer|jwxt|epay|ehall|ldxt|xgxt)\.ysu\.edu\.cn|http:\/\/(202\.206\.247\.49|xgxt\.ysu\.edu\.cn))$/.test(
      parsed.origin
    )
  if (depth > 0 && !schoolOrigin) throw new Error("认证回调仅允许学校接口")
  const roleChange =
    method === "POST" &&
    parsed.origin === "https://xgxt.ysu.edu.cn" &&
    /^\/xsfw\/sys\/funauthapp\/api\/changeAppRole\/zhcptybbapp\/[A-Za-z0-9_-]+\.do$/.test(
      parsed.pathname
    )
  const allowed =
    roleChange ||
    [...policy.routes, ...policy.skbirdRoutes].some(
      (route) =>
        route.origin === parsed.origin && route.method === method && route.path === parsed.pathname
    ) ||
    (method === "GET" &&
      policy.mediaRoutes.some(
        (route) => route.origin === parsed.origin && parsed.pathname.startsWith(route.pathPrefix)
      ))
  if (!allowed) {
    // Report only a bounded, non-parameterized path on the fixed campus host.
    // Never display query strings, fragments, or potentially sensitive path segments.
    const laborPath =
      parsed.origin === "https://ldxt.ysu.edu.cn" &&
      /^\/(About|System|XueFen)(\/[A-Za-z_-]{1,30})*\/?$/.test(parsed.pathname)
    if (laborPath) throw new Error(`劳动教育接口未获准：${parsed.pathname}`)
    const safePath =
      parsed.origin === "http://202.206.247.49" &&
      /^\/ysu_(pt|xf)(\/[A-Za-z_-]{1,30})*\/?$/.test(parsed.pathname)
    throw new Error(
      safePath ? `双创接口未获准：${parsed.pathname}` : "仅允许直接访问已审核的学校与森空鸟接口"
    )
  }
  if (
    parsed.pathname === "/jwapp/sys/emaphome/appShow.do" &&
    !policy.appIds.includes(parsed.searchParams.get("id") ?? "")
  ) {
    throw new Error("未审核的教务应用")
  }
  // Authentication must not send service tickets to an unreviewed callback.
  const form = new URLSearchParams(body)
  for (const params of [parsed.searchParams, form]) {
    for (const key of ["service", "success"]) {
      const services = params.getAll(key)
      if (services.length > 1) throw new Error("安全策略禁止重复回调参数")
      const service = services[0]
      if (service) assertHarmonyRequest("GET", service, undefined, depth + 1)
    }
  }
}
