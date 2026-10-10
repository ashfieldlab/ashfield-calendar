import type { ReactNode } from "react"

export default function CancelLayout({ children }: { children: ReactNode }) {
  return <div className="grid min-h-screen place-items-center bg-muted/40 px-4 py-10 dark:bg-background">{children}</div>
}
