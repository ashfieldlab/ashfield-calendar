import { SettingsNav } from "@/components/settings/settings-nav"

/** 설정: 본문 안 왼쪽 메뉴 칸 + 오른쪽 내용. 워크스페이스 관리 화면도 같은 틀을 쓴다. */
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-0 flex-col md:flex-row" data-testid="settings-layout">
      <SettingsNav />
      <div className="min-h-0 min-w-0 flex-1">{children}</div>
    </div>
  )
}
