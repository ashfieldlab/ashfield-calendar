/**
 * E2E 공통 fixtures.
 *
 *   - loginAs("admin" | "member_a" | "member_b"): 계정 서버(DEV 비밀번호 폼 또는 SSO)를 거쳐
 *     로그인한 뒤 앱 첫 화면 (e2e/auth.ts: 계정 서버가 AUTH_DEV_PASSWORD_LOGIN=true 로 떠 있어야 함)
 */

import { test as base, expect, type Page } from "@playwright/test"

import { APP } from "../lib/apps"
import { E2E_USERS, signIn, type E2EUserKey } from "./auth"

export const test = base.extend<{
  loginAs: (key: E2EUserKey) => Promise<void>
}>({
  loginAs: async ({ page }, use) => {
    const fn = async (key: E2EUserKey) => {
      await loginAs(page, key)
    }
    await use(fn)
  },
})

export { expect }

/** E2E 사용자로 로그인하고 앱 첫 화면으로 이동. */
export async function loginAs(page: Page, key: E2EUserKey): Promise<void> {
  await signIn(page, E2E_USERS[key])
  await page.goto(APP.home)
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
