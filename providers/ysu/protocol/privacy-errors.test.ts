import { beforeEach, describe, expect, it, vi } from "vitest"

const transport = vi.hoisted(() => ({ fetch: vi.fn() }))

vi.mock("@/lib/cookie", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/cookie")>()
  return { ...actual, fetchWithJar: transport.fetch }
})
vi.mock("./cas", () => ({
  authorize: vi.fn().mockResolvedValue(undefined),
  getCredentialApplied: vi.fn().mockResolvedValue(undefined),
}))

import { queryCreditBatches, resetScxt } from "./scxt"
import { queryEvaluationTerms, resetXgxt } from "./xgxt"
import { setSchoolConfig } from "@/lib/server-config"

beforeEach(() => {
  setSchoolConfig("ysu")
  resetScxt()
  resetXgxt()
  transport.fetch.mockReset()
})

describe("academic protocol errors protect private data", () => {
  it("does not expose a ticket from an unexpected dual-innovation redirect", async () => {
    transport.fetch.mockResolvedValue({
      status: 302,
      headers: { location: "http://example.invalid/?ticket=private-ticket" },
    })
    const error = await queryCreditBatches().catch((e: Error) => e)
    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toContain("302")
    expect((error as Error).message).not.toContain("private-ticket")
    expect((error as Error).message).not.toContain("example.invalid")
  })

  it("does not expose the raw response from a malformed role setup response", async () => {
    transport.fetch.mockResolvedValue({
      status: 200,
      headers: { "content-type": "text/html" },
      text: async () => "<html>private-student-data</html>",
    })
    const error = await queryEvaluationTerms().catch((e: Error) => e)
    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toContain("non-JSON")
    expect((error as Error).message).not.toContain("private-student-data")
  })

  it("does not expose personal details from an invalid role configuration", async () => {
    transport.fetch.mockResolvedValue({
      status: 200,
      headers: { "content-type": "application/json" },
      text: async () =>
        JSON.stringify({ HEADER: { dropMenu: [{ active: true, name: "private-name" }] } }),
    })
    const error = await queryEvaluationTerms().catch((e: Error) => e)
    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toContain("缺少 id")
    expect((error as Error).message).not.toContain("private-name")
  })
})
