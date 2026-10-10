import { E2E_USERS, setActiveWorkspace, setupSharedWorkspace, signOut } from "./auth"
import { createCalendar, selectCalendar, showListView, test, expect } from "./fixtures"

test.describe("event invitations", () => {
  test("admin 이 일정 만들고 member_a 초대 → member_a 수락 시 본인 캘린더에 노출", async ({
    page,
    loginAs,
  }) => {
    // admin 의 공유 워크스페이스(계정 서버에서 생성과 초대)에 member_a 가 들어온다.
    const { workspaceId, memberSub } = await setupSharedWorkspace(
      page,
      E2E_USERS.admin,
      E2E_USERS.member_a,
      `초대 팀 ${Date.now()}`,
    )
    await setActiveWorkspace(page, workspaceId)
    await page.goto("/calendar")

    const calName = `초대-${Date.now()}`
    await createCalendar(page, calName, { shared: true })

    const title = `초대이벤트-${Date.now()}`
    await page.getByTestId("calendar-new-event-button").click()
    await page.getByTestId("event-form-title-input").fill(title)
    await selectCalendar(page, calName)
    await page.getByTestId("event-form-save-button").click()
    await showListView(page)

    // 다시 클릭해서 상세 시트 → 편집 모달 → 초대
    await page.getByText(title).first().click()
    await page.getByTestId("event-detail-edit-button").click()
    await expect(page.getByTestId("event-form")).toBeVisible()
    await page
      .getByTestId("invitation-input")
      .fill(E2E_USERS.member_a.email.split("@")[0])
    await page.getByTestId(`invitation-option-${memberSub}`).click()
    await expect(
      page.locator(`[data-testid^="invitation-row-"]`).first(),
    ).toBeVisible()
    await page.getByTestId("event-form-cancel-button").click()

    // member_a 로 전환 (admin 의 워크스페이스를 활성 워크스페이스로): 초대받은 이벤트가 보여야 함
    await signOut(page)
    await setActiveWorkspace(page, workspaceId)
    await loginAs("member_a")
    await page.goto("/calendar")
    await showListView(page)
    await expect(page.getByText(title).first()).toBeVisible({ timeout: 5000 })

    // 상세 시트에서 참석 응답
    await page.getByText(title).first().click()
    await page.getByTestId("event-detail-rsvp-tentative").click()
    await expect(page.getByTestId("event-detail-rsvp-tentative")).toHaveAttribute("aria-checked", "true")
    await page.getByTestId("event-detail-close-button").click()

    // 초대 알림: 헤더 벨 unread 배지 + 패널 항목
    await expect(page.getByTestId("notification-unread-badge")).toBeVisible({
      timeout: 5_000,
    })
    await page.getByTestId("notification-bell").click()
    await expect(page.getByTestId("notification-panel")).toBeVisible()

    // 알림 페이지에서 바로 응답: 응답 필요 알림이 먼저 열려 있다
    await page.getByTestId("notification-see-all").click()
    await expect(page.getByTestId("notifications-detail")).toContainText(title)
    await page.getByTestId("notifications-detail-rsvp-accepted").click()
    await expect(page.getByTestId("notifications-detail-rsvp-accepted")).toHaveAttribute("aria-pressed", "true")
    await expect(page.getByTestId("notifications-filter-respond")).toHaveText("응답 필요 0")
  })

  test("새 일정에서 고른 참석자는 저장하면 초대된다", async ({ page, loginAs }) => {
    await loginAs("member_a")
    await page.goto("/calendar")
    const calName = `참석-${Date.now()}`
    await createCalendar(page, calName)

    const title = `참석이벤트-${Date.now()}`
    const guest = `guest-${Date.now()}@example.com`
    await page.getByTestId("calendar-new-event-button").click()
    await page.getByTestId("event-form-title-input").fill(title)
    await selectCalendar(page, calName)
    await page.getByTestId("event-form-attendee-input").fill(guest)
    await page.getByTestId("event-form-attendee-add").click()
    await expect(page.getByTestId("event-form-attendee-list")).toContainText(guest)
    await page.getByTestId("event-form-save-button").click()
    await expect(page.getByTestId("event-form")).toHaveCount(0)

    await showListView(page)
    await page.getByText(title).first().click()
    await page.getByTestId("event-detail-tab-people").click()
    await expect(page.getByTestId("event-detail-people")).toContainText(guest)
  })
})
