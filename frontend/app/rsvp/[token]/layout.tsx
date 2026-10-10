import type { ReactNode } from "react"

export default function RsvpLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-md px-4 py-12">{children}</div>
    </div>
  )
}
