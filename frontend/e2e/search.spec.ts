import { createCalendar, selectCalendar, test, expect } from "./fixtures"

test.describe("global search", () => {
  test("일정 생성 후 검색 팔레트로 매칭, 열면 상세 시트", async ({
    page,
    loginAs,
  }) => {
    await loginAs("member_a")
    await page.goto("/calendar")
    const term = `srch${Date.now()}`
    const calName = `검색-${Date.now()}`

    await createCalendar(page, calName)

    const title = `${term}-event`
    await page.getByTestId("calendar-new-event-button").click()
    await page.getByTestId("event-form-title-input").fill(title)
    await selectCalendar(page, calName)
    await page.getByTestId("event-form-save-button").click()

    // 헤더 검색 단추 → 팔레트
    await page.getByTestId("global-search-button").click()
    await page.getByTestId("search-modal-input").fill(term)
    const hit = page.locator(`[data-testid^="search-modal-event-"]`, {
      hasText: title,
    })
    await expect(hit).toBeVisible({ timeout: 5000 })
    await page.getByTestId("search-modal-input").press("Enter")
    await expect(page.getByTestId("search-modal")).toHaveCount(0)
    await expect(page).toHaveURL(/\/calendar$/)
    await expect(page.getByTestId("event-detail-title")).toHaveText(title)

    // 최근 검색 칩
    await page.keyboard.press("Control+k")
    await expect(page.getByTestId(`search-modal-recent-${term}`)).toBeVisible()
  })

  test("결과 없는 검색어는 '결과 없음' 표시", async ({ page, loginAs }) => {
    await loginAs("member_a")
    await page.goto("/calendar")
    await page.getByTestId("global-search-button").click()
    await page.getByTestId("search-modal-input").fill("zzzz-no-match-xxx-9999")
    await expect(page.getByTestId("search-modal-empty")).toBeVisible({
      timeout: 3000,
    })
  })
})
