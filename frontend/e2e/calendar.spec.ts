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
    // 캘린더 select: calName 으로 변경 (워크스페이스 기본 캘린더가 위에 있을 수 있어 명시)
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

    // 왼쪽 캘린더 목록에서 토글
    const toggle = page
      .getByTestId(/^calendar-sidebar-checkbox-/)
      .filter({ hasText: calName })
      .getByTestId(/^calendar-sidebar-toggle-/)
    // 체크 상태는 서버 응답 뒤 바뀐다 (낙관적 갱신 없음): 클릭 후 꺼질 때까지 기다린다.
    await toggle.click()
    await expect(toggle).not.toBeChecked()

    await expect(page.getByText(title)).toHaveCount(0)
  })

  test("월 보기에서 날짜 칸을 누르면 그날 일정 목록, + 는 새 일정, 날짜 숫자는 일 보기", async ({ page, loginAs }) => {
    await loginAs("member_a")
    await page.goto("/calendar")
    const calName = `칸-${Date.now()}`
    await createCalendar(page, calName)

    const title = `칸이벤트-${Date.now()}`
    await page.getByTestId("calendar-new-event-button").click()
    await page.getByTestId("event-form-title-input").fill(title)
    await selectCalendar(page, calName)
    await page.getByTestId("event-form-save-button").click()
    await expect(page.getByTestId("event-form")).toHaveCount(0)

    // 오늘 칸의 빈 곳을 누르면 팝오버에 방금 만든 일정이 보인다
    const today = page.locator(".fc-daygrid-day.fc-day-today")
    const box = (await today.boundingBox())!
    await page.mouse.click(box.x + box.width / 2, box.y + box.height - 8)
    const pop = page.getByTestId("calendar-day-popover")
    await expect(pop).toBeVisible()
    await expect(pop.getByText(title)).toBeVisible()
    await pop.getByText(title).click()
    await expect(page.getByTestId("event-form-title-input")).toHaveValue(title)
    await page.getByTestId("event-form-cancel-button").click()

    // + 는 바로 새 일정
    await today.hover()
    await today.locator(".cal-day-add").click()
    await expect(page.getByTestId("event-form")).toBeVisible()
    await expect(page.getByTestId("calendar-day-popover")).toHaveCount(0)
    await page.getByTestId("event-form-cancel-button").click()

    // 날짜 숫자는 일 보기로
    await today.locator("a.fc-daygrid-day-number").click()
    await expect(page.locator(".fc-timeGridDay-view")).toBeVisible()
  })
})
