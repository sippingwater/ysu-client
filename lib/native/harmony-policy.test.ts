import { describe, expect, it } from "vitest"
import { assertHarmonyRequest } from "./harmony-policy"
import policy from "../../harmony/security-policy.json"

const official = "https://jwxt.ysu.edu.cn"

describe("Harmony local-only security policy", () => {
  it("allows reviewed read-only POSTs and the explicit student evaluation exception", () => {
    expect(() =>
      assertHarmonyRequest("POST", `${official}/jwapp/sys/cjcx/modules/cjcx/xscjcx.do`)
    ).not.toThrow()
    expect(() =>
      assertHarmonyRequest(
        "POST",
        `${official}/jwapp/sys/pjapp/api/wdpj/commitQuestionnaireAnswer.do`
      )
    ).not.toThrow()
  })

  it.each([
    "https://ysu.welain.com/api/proxy?url=https://jwxt.ysu.edu.cn",
    "https://jwxt.ysu.edu.cn.evil.example/jwapp/sys/cjcx/modules/cjcx/xscjcx.do",
    "https://jwxt.ysu.edu.cn@evil.example/jwapp/sys/cjcx/modules/cjcx/xscjcx.do",
    "https://attacker@jwxt.ysu.edu.cn/jwapp/sys/cjcx/modules/cjcx/xscjcx.do",
    "http://jwxt.ysu.edu.cn/jwapp/sys/cjcx/modules/cjcx/xscjcx.do",
    "https://jwxt.ysu.edu.cn:8443/jwapp/sys/cjcx/modules/cjcx/xscjcx.do",
    "https://127.0.0.1/jwapp/sys/cjcx/modules/cjcx/xscjcx.do",
    "https://open.weixin.qq.com/connect/qrconnect",
  ])("rejects proxies, third parties and alternate authorities: %s", (input) => {
    expect(() => assertHarmonyRequest("POST", input)).toThrow()
  })

  it.each([
    "/jwapp/sys/bkbl/modules/bkbm/xgksrwxs.do",
    "/jwapp/sys/xywccx/modules/xywccx/bysc.do",
    "/jwmobile/biz/v410/signin/delete",
    "/jwapp/sys/cjcx/modules/cjcx/delete.do",
    "/jwapp/sys/cjcx/modules/cjcx/%78scjcx.do",
  ])("rejects unreviewed actions even on the official host: %s", (path) => {
    expect(() => assertHarmonyRequest("POST", `${official}${path}`)).toThrow()
  })

  it("validates authentication callbacks before credentials are sent", () => {
    const url = "https://cer.ysu.edu.cn/authserver/login"
    expect(() =>
      assertHarmonyRequest("POST", url, "service=https%3A%2F%2Fevil.example%2F")
    ).toThrow()
    expect(() =>
      assertHarmonyRequest(
        "POST",
        url,
        `service=${encodeURIComponent(`${official}/jwapp/sys/emaphome/portal/index.do`)}`
      )
    ).not.toThrow()
    expect(() =>
      assertHarmonyRequest(
        "GET",
        `${url}?service=${encodeURIComponent("https://ysu.welain.com/api/proxy")}`
      )
    ).toThrow()
    expect(() =>
      assertHarmonyRequest(
        "POST",
        url,
        `service=${encodeURIComponent(`${official}/jwapp/sys/emaphome/portal/index.do`)}&service=https%3A%2F%2Fevil.example%2F`
      )
    ).toThrow()
  })

  it("limits methods per endpoint and never permits payment or registration actions", () => {
    expect(() =>
      assertHarmonyRequest("DELETE", `${official}/jwapp/sys/cjcx/modules/cjcx/xscjcx.do`)
    ).toThrow()
    expect(
      policy.routes.filter((route) => /bysc|xgksrwxs|payment|recharge/.test(route.path))
    ).toEqual([])
    expect(
      policy.routes.every((route) =>
        /^(https:\/\/[a-z]+\.ysu\.edu\.cn|http:\/\/(202\.206\.247\.49|xgxt\.ysu\.edu\.cn)|https:\/\/xqh5\.17wanxiao\.com)$/.test(
          route.origin
        )
      )
    ).toBe(true)
  })

  it("allows the added query and authentication routes while rejecting other actions", () => {
    for (const [method, target] of [
      ["GET", "https://ldxt.ysu.edu.cn/XueFen/Summary"],
      ["GET", "http://202.206.247.49/ysu_pt/UnifiedAuth/CASLogin"],
      [
        "POST",
        "https://xgxt.ysu.edu.cn/xsfw/sys/zhcptybbapp/modules/evaluationApplyController/getCpxnxq.do",
      ],
      [
        "POST",
        "https://xgxt.ysu.edu.cn/xsfw/sys/funauthapp/api/changeAppRole/zhcptybbapp/student-1.do",
      ],
      ["POST", "https://xqh5.17wanxiao.com/smartWaterAndElectricityService/SWAEEncryptServlet"],
    ])
      expect(() => assertHarmonyRequest(method, target)).not.toThrow()
    expect(() =>
      assertHarmonyRequest("POST", "https://ldxt.ysu.edu.cn/XueFen/Enroll/Index")
    ).toThrow()
    expect(() =>
      assertHarmonyRequest(
        "POST",
        "https://xgxt.ysu.edu.cn/xsfw/sys/funauthapp/api/changeAppRole/other/student.do"
      )
    ).toThrow()
    expect(() =>
      assertHarmonyRequest(
        "GET",
        "https://cer.ysu.edu.cn/authserver/login?service=" +
          encodeURIComponent(
            "https://xqh5.17wanxiao.com/smartWaterAndElectricityService/SWAEEncryptServlet"
          )
      )
    ).toThrow()
  })

  it("allows the innovation platform authentication landing pages", () => {
    for (const path of ["/ysu_pt", "/ysu_pt/", "/ysu_pt/System/User/LoginRole", "/ysu_pt/Error"]) {
      expect(() => assertHarmonyRequest("GET", `http://202.206.247.49${path}`)).not.toThrow()
      expect(() => assertHarmonyRequest("POST", `http://202.206.247.49${path}`)).toThrow()
    }
    expect(() =>
      assertHarmonyRequest("GET", "http://202.206.247.49/ysu_pt/Unknown?ticket=secret")
    ).toThrow("双创接口未获准：/ysu_pt/Unknown")
    expect(() =>
      assertHarmonyRequest("GET", "http://202.206.247.49/ysu_pt/secret123?ticket=secret")
    ).toThrow("仅允许直接访问已审核的学校与森空鸟接口")
  })

  it("allows the labor home landing but not writes or unrelated endpoints", () => {
    expect(() => assertHarmonyRequest("GET", "https://ldxt.ysu.edu.cn")).not.toThrow()
    expect(() => assertHarmonyRequest("POST", "https://ldxt.ysu.edu.cn/")).toThrow()
    expect(() =>
      assertHarmonyRequest("GET", "https://ldxt.ysu.edu.cn/System/Unknown?ticket=secret")
    ).toThrow("劳动教育接口未获准：/System/Unknown")
    expect(() =>
      assertHarmonyRequest("GET", "https://ldxt.ysu.edu.cn/System/secret123?ticket=secret")
    ).toThrow("仅允许直接访问已审核的学校与森空鸟接口")
  })

  it("allows only the six reviewed mobile auth, activity and sign-in routes", () => {
    const expected = [
      ["GET", "/jwmobile/auth/index"],
      ["GET", "/jwmobile/biz/v410/"],
      ["POST", "/jwmobile/biz/v410/lesson/queryCurrentLesson"],
      ["POST", "/jwmobile/biz/v410/signin/detail"],
      ["POST", "/jwmobile/biz/v410/signin/querySigninDetail"],
      ["POST", "/jwmobile/biz/v410/signin/sign"],
    ]
    expect(
      policy.routes
        .filter((route) => route.path.startsWith("/jwmobile/"))
        .map((route) => [route.method, route.path])
    ).toEqual(expected)
    for (const [method, path] of expected) {
      expect(() => assertHarmonyRequest(method, `${official}${path}`)).not.toThrow()
      expect(() =>
        assertHarmonyRequest(method === "GET" ? "POST" : "GET", `${official}${path}`)
      ).toThrow()
    }
    expect(() =>
      assertHarmonyRequest(
        "GET",
        `https://cer.ysu.edu.cn/authserver/login?service=${encodeURIComponent(`${official}/jwmobile/auth/index`)}`
      )
    ).not.toThrow()
    expect(() =>
      assertHarmonyRequest("GET", `${official}/jwmobile/index.html?token=test`)
    ).toThrow()
  })

  it("allows community endpoints and HTTPS images while keeping school callbacks separate", () => {
    for (const route of policy.skbirdRoutes) {
      expect(() => assertHarmonyRequest(route.method, `${route.origin}${route.path}`)).not.toThrow()
      expect(() => assertHarmonyRequest("DELETE", `${route.origin}${route.path}`)).toThrow()
    }
    for (const image of [
      "https://b1.cdn.zanao.com/upload/image.jpg@!common",
      "https://thirdwx.qlogo.cn/mmopen/avatar/132",
      "https://thirdwx.qlogo.cn/mmhead/avatar/132",
    ]) {
      expect(() => assertHarmonyRequest("GET", image)).not.toThrow()
      expect(() => assertHarmonyRequest("POST", image)).toThrow()
      expect(() =>
        assertHarmonyRequest(
          "GET",
          `https://cer.ysu.edu.cn/authserver/login?service=${encodeURIComponent(image)}`
        )
      ).toThrow()
    }
    for (const target of [
      "http://api.app.zanao.com/user/info",
      "http://api.app.zanao.com/thread/like",
    ]) {
      expect(() =>
        assertHarmonyRequest(
          "POST",
          "https://cer.ysu.edu.cn/authserver/login",
          `service=${encodeURIComponent(target)}`
        )
      ).toThrow()
    }
  })

  it.each([
    "http://api.app.zanao.com/thread/delete",
    "http://api.app.zanao.com/user/login",
    "http://api.app.zanao.com.evil.example/thread/hot",
    "http://api.app.zanao.com:8080/thread/hot",
    "http://b1.cdn.zanao.com/upload/image.jpg",
    "https://b2.cdn.zanao.com/upload/image.jpg",
    "https://b1.cdn.zanao.com/private/file",
    "https://thirdwx.qlogo.cn/unreviewed/file",
  ])("rejects unreviewed community or media targets: %s", (target) => {
    expect(() => assertHarmonyRequest("GET", target)).toThrow()
  })
})
