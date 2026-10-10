import type { ReactNode } from "react"

export default function PublicBookLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen overflow-x-hidden bg-muted/40 dark:bg-background">{children}</div>
}
