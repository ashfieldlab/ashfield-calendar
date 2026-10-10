import { createCalendar, selectCalendar, test, expect } from "./fixtures"

test.describe("global search", () => {
  test("일정 생성 후 검색바로 매칭 → 클릭 시 /calendar 로 이동", async ({
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

    // 헤더 검색
    await page.getByTestId("global-search-input").fill(term)
    await expect(page.getByTestId("global-search-results")).toBeVisible({
      timeout: 5000,
    })
    const hit = page.locator(`[data-testid^="global-search-event-"]`, {
      hasText: title,
    })
    await expect(hit).toBeVisible()
    await hit.click()
    await expect(page).toHaveURL(/\/calendar/)
  })

  test("결과 없는 검색어는 '결과가 없습니다' 표시", async ({ page, loginAs }) => {
    await loginAs("member_a")
    await page.goto("/calendar")
    await page.getByTestId("global-search-input").fill("zzzz-no-match-xxx-9999")
    await expect(page.getByText("결과가 없습니다.")).toBeVisible({
      timeout: 3000,
    })
  })
})
