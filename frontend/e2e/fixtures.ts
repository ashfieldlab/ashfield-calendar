/**
 * E2E 공통 fixtures.
 *
 *   - loginAs(page, "admin" | "member_a" | ...): /api/auth/dev-login 으로 dev 로그인
 *   - cleanup(page): 로그아웃
 *
 * SKIP_AUTH=true 환경에서만 동작. 백엔드도 동일 모드로 떠 있어야 dev JWT가 검증됨.
 */

import { test as base, expect, type Page } from "@playwright/test"

import { APP } from "../lib/apps"
import { DEV_USERS } from "../lib/dev-users"

type DevUserKey = keyof typeof DEV_USERS

export const test = base.extend<{
  loginAs: (key: DevUserKey) => Promise<void>
}>({
  loginAs: async ({ page }, use) => {
    const fn = async (key: DevUserKey) => {
      await loginAs(page, key)
    }
    await use(fn)
  },
})

export { expect }


/**
 * dev 사용자 로그인 (SKIP_AUTH 모드). dev-login 이 dev_token 쿠키를 심고 앱 첫 화면으로 보낸다.
 */
export async function loginAs(page: Page, key: DevUserKey): Promise<void> {
  await page.goto(`/api/auth/dev-login?u=${key}&redirect=${encodeURIComponent(APP.home)}`)
  await page.waitForLoadState("networkidle")
}

/**
 * 앱 확인 창(useConfirm — components/ui-custom/use-confirm.tsx)의 확인 버튼을 누른다.
 */
export async function confirmDialog(page: Page): Promise<void> {
  await page.getByTestId("confirm-dialog-confirm").click()
}

/**
 * 캘린더 목록 팝오버를 열어 새 캘린더를 만들고 닫는다. (캘린더 목록은 사이드바가 아니라
 * 헤더의 팝오버에 있다.)
 */
export async function createCalendar(
  page: Page,
  name: string,
  { shared = false }: { shared?: boolean } = {},
): Promise<void> {
  await page.getByTestId("calendars-popover-trigger").click()
  await page.getByTestId("calendar-new-button").click()
  await page.getByTestId("calendar-new-name-input").fill(name)
  if (shared) await page.getByTestId("calendar-new-scope-shared").check()
  await page.getByTestId("calendar-new-confirm").click()
  // 새 캘린더 창이 뜨면서 팝오버는 닫힌다 — 다시 열어 목록에 생겼는지 확인 후 닫는다.
  await expect(page.getByTestId("calendar-new-modal")).toHaveCount(0)
  await page.getByTestId("calendars-popover-trigger").click()
  await expect(page.getByTestId("calendars-popover-content").getByText(name)).toBeVisible()
  await page.keyboard.press("Escape")
}

/** 일정 편집 창에서 캘린더를 이름으로 고른다. 공유 캘린더는 앞에 표시가 붙어 정확히 일치하지 않는다. */
export async function selectCalendar(page: Page, name: string): Promise<void> {
  const select = page.getByTestId("event-form-calendar-select")
  const value = await select.locator("option", { hasText: name }).getAttribute("value")
  await select.selectOption(value!)
}

/**
 * 목록 보기로 전환. 월간 보기는 칸이 넘치면 일정을 "+N개 더"로 접어 숨겨서, 공유 dev DB 에
 * 일정이 쌓이면 확인이 흔들린다. 목록 보기는 접지 않는다.
 */
export async function showListView(page: Page): Promise<void> {
  await page.getByTestId("calendar-view-listWeek").click()
}
