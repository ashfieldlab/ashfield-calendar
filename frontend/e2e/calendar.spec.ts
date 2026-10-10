import { createCalendar, selectCalendar, showListView, test, expect } from "./fixtures"

test.describe("/calendar", () => {
  test("개인 캘린더 생성 → 일정 만들기 → 월 뷰에 노출", async ({
    page,
    loginAs,
  }) => {
    await loginAs("member_a")
    await page.goto("/calendar")
    await expect(page.getByTestId("calendar-page")).toBeVisible()

    const calName = `캘-${Date.now()}`

    // 사이드바 + 버튼 → 새 캘린더 모달
    await createCalendar(page, calName)

    // 새 일정
    const title = `테스트-${Date.now()}`
    await page.getByTestId("calendar-new-event-button").click()
    await page.getByTestId("event-form-title-input").fill(title)
    // 캘린더 select: calName 으로 변경 (회사 기본 캘린더가 위에 있을 수 있어 명시)
    await selectCalendar(page, calName)
    await page.getByTestId("event-form-save-button").click()
    await showListView(page)

    // 월 뷰에 노출
    await expect(page.getByText(title).first()).toBeVisible({ timeout: 5000 })
  })

  test("캘린더 hidden 토글 시 일정도 숨김", async ({ page, loginAs }) => {
    await loginAs("member_a")
    await page.goto("/calendar")

    const calName = `토글-${Date.now()}`
    await createCalendar(page, calName)

    const title = `토글이벤트-${Date.now()}`
    await page.getByTestId("calendar-new-event-button").click()
    await page.getByTestId("event-form-title-input").fill(title)
    await selectCalendar(page, calName)
    await page.getByTestId("event-form-save-button").click()
    await showListView(page)
    await expect(page.getByText(title).first()).toBeVisible()

    // 캘린더 목록 팝오버에서 토글
    await page.getByTestId("calendars-popover-trigger").click()
    const toggle = page
      .getByTestId(/^calendar-sidebar-checkbox-/)
      .filter({ hasText: calName })
      .getByTestId(/^calendar-sidebar-toggle-/)
    // 체크 상태는 서버 응답 뒤 바뀐다 (낙관적 갱신 없음): 클릭 후 꺼질 때까지 기다린다.
    await toggle.click()
    await expect(toggle).not.toBeChecked()
    await page.keyboard.press("Escape")

    await expect(page.getByText(title)).toHaveCount(0)
  })
})
