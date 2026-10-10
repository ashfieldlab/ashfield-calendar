import type { ReactNode } from "react"

export default function PublicBookLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-muted/50 dark:bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">{children}</div>
    </div>
  )
}
