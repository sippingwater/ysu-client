import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { zh } from "@/lib/i18n/dict"

const queries = vi.hoisted(() => ({ summary: vi.fn(), records: vi.fn(), activities: vi.fn() }))
vi.mock("@/providers/hooks", () => ({
  useLaborSummary: queries.summary,
  useLaborRecords: queries.records,
  useLaborActivities: queries.activities,
}))
vi.mock("@/lib/i18n/use-translation", () => ({
  useTranslation: () => ({
    t: (key: string) =>
      key.split(".").reduce<unknown>((value, part) => (value as Record<string, unknown>)[part], zh),
  }),
}))
import LaborPage from "./page"

function query(overrides: Record<string, unknown> = {}) {
  return {
    data: undefined,
    error: undefined,
    isLoading: false,
    isValidating: false,
    mutate: vi.fn(),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  queries.summary.mockReturnValue(query())
  queries.records.mockReturnValue(query({ data: [] }))
  queries.activities.mockReturnValue(query())
})

describe("labor education query states", () => {
  it("shows one retryable error instead of empty records and an empty summary card", () => {
    const failure = query({ error: new Error("redirect blocked") })
    queries.summary.mockReturnValue(failure)
    queries.records.mockReturnValue(failure)
    const html = renderToStaticMarkup(createElement(LaborPage))
    expect(html.match(/role="alert"/g)).toHaveLength(1)
    expect(html).toContain("劳动教育加载失败")
    expect(html).toContain("重试")
    expect(html).not.toContain("暂无劳动记录")
    expect(html).not.toContain('data-slot="card"')
    expect(queries.activities).toHaveBeenCalledWith(false)
  })

  it("shows empty state only after a successful empty result", () => {
    const html = renderToStaticMarkup(createElement(LaborPage))
    expect(html).toContain("暂无劳动记录")
    expect(html).not.toContain("劳动教育加载失败")
  })

  it("shows loading placeholders before the first result", () => {
    queries.records.mockReturnValue(query({ isLoading: true, isValidating: true }))
    const html = renderToStaticMarkup(createElement(LaborPage))
    expect(html).toContain('data-slot="skeleton"')
    expect(html).not.toContain("暂无劳动记录")
  })

  it("keeps available data visible when another query fails", () => {
    queries.summary.mockReturnValue(query({ error: new Error("summary unavailable") }))
    queries.records.mockReturnValue(query({ data: [{ name: "校园劳动", hours: 2 }] }))
    const html = renderToStaticMarkup(createElement(LaborPage))
    expect(html).toContain("校园劳动")
    expect(html).toContain("劳动教育加载失败")
    expect(html).not.toContain("暂无劳动记录")
  })
})
