import type { ReactNode } from "react"

export default function CancelLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-muted/50 dark:bg-background">
      <div className="mx-auto max-w-md px-4 py-12">{children}</div>
    </div>
  )
}
