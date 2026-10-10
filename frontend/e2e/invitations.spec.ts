import {
  E2E_USERS,
  addMember,
  me,
  personalCompanyId,
  setActiveCompany,
  signOut,
} from "./auth"
import { createCalendar, selectCalendar, showListView, test, expect } from "./fixtures"

test.describe("event invitations", () => {
  test("admin 이 일정 만들고 member_a 초대 → member_a 수락 시 본인 캘린더에 노출", async ({
    page,
    loginAs,
  }) => {
    // member_a 첫 로그인 (로컬 사용자 행 생성) → admin 의 워크스페이스에 멤버로 추가
    await loginAs("member_a")
    const memberSub = (await me(page)).sub
    await signOut(page)

    await loginAs("admin")
    const companyId = await personalCompanyId(page)
    await addMember(page, companyId, E2E_USERS.member_a.email)
    await setActiveCompany(page, companyId)
    await page.goto("/calendar")

    const calName = `초대-${Date.now()}`
    await createCalendar(page, calName, { shared: true })

    const title = `초대이벤트-${Date.now()}`
    await page.getByTestId("calendar-new-event-button").click()
    await page.getByTestId("event-form-title-input").fill(title)
    await selectCalendar(page, calName)
    await page.getByTestId("event-form-save-button").click()
    await showListView(page)

    // 다시 클릭해서 편집 모달 → 초대
    await page.getByText(title).first().click()
    await expect(page.getByTestId("event-form")).toBeVisible()
    await page
      .getByTestId("invitation-grantee-input")
      .fill(E2E_USERS.member_a.email.split("@")[0])
    await page.getByTestId(`user-autocomplete-option-${memberSub}`).click()
    await page.getByTestId("invitation-add-button").click()
    await expect(
      page.locator(`[data-testid^="invitation-row-"]`).first(),
    ).toBeVisible()
    await page.getByTestId("event-form-cancel-button").click()

    // member_a 로 전환 (admin 의 워크스페이스를 활성 회사로) — 초대받은 이벤트가 보여야 함
    await signOut(page)
    await setActiveCompany(page, companyId)
    await loginAs("member_a")
    await page.goto("/calendar")
    await showListView(page)
    await expect(page.getByText(title).first()).toBeVisible({ timeout: 5000 })

    // 초대 알림 — 헤더 벨 unread 배지 + 패널 항목
    await expect(page.getByTestId("notification-unread-badge")).toBeVisible({
      timeout: 5_000,
    })
    await page.getByTestId("notification-bell").click()
    await expect(page.getByTestId("notification-panel")).toBeVisible()
  })
})
