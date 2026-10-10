"use client"

import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { api } from "@/lib/api-client"
import type { WorkspaceMember, WorkspaceMembersResponse } from "@/lib/types/api"
import { cn } from "@/lib/utils"

interface Props {
  onAddMember: (sub: string, member: WorkspaceMember) => void | Promise<void>
  /** 멤버 목록에서 고르지 않고 이메일을 직접 넣은 경우. 회원 이메일이면 서버가 회원 초대로 바꾼다. */
  onAddEmail: (email: string) => void | Promise<void>
  busy?: boolean
  /** data-testid 접두사 */
  testid: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** 참석자 추가 입력 한 줄: 이름으로 멤버를 검색하거나 이메일을 바로 넣는다. 새 일정·일정 수정이 같이 쓴다. */
export function AttendeeInputs({ onAddMember, onAddEmail, busy, testid }: Props) {
  const [text, setText] = useState("")
  const [items, setItems] = useState<WorkspaceMember[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)

  const query = text.trim()
  const isEmail = EMAIL_RE.test(query)

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    if (!query) {
      timer.current = setTimeout(() => setItems([]), 0)
      return
    }
    timer.current = setTimeout(async () => {
      try {
        const r = await api<WorkspaceMembersResponse>(
          `/api/v1/me/workspace/members?q=${encodeURIComponent(query)}&limit=8`,
        )
        setItems(r.members)
        setActive(-1)
      } catch {
        setItems([])
      }
    }, 200)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [query])

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [])

  function reset() {
    setText("")
    setItems([])
    setOpen(false)
    setActive(-1)
  }

  async function pick(m: WorkspaceMember) {
    await onAddMember(m.sub, m)
    reset()
  }

  async function submit() {
    if (active >= 0 && items[active]) return pick(items[active])
    const exact = items.find((m) => m.email.toLowerCase() === query.toLowerCase())
    if (exact) return pick(exact)
    if (!isEmail) return
    await onAddEmail(query)
    reset()
  }

  return (
    <div className="flex gap-2" ref={boxRef}>
      <div className="relative min-w-0 flex-1">
        <input
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault()
              setActive((i) => Math.min(i + 1, items.length - 1))
            } else if (e.key === "ArrowUp") {
              e.preventDefault()
              setActive((i) => Math.max(i - 1, -1))
            } else if (e.key === "Enter") {
              e.preventDefault()
              void submit()
            } else if (e.key === "Escape" && open) {
              e.stopPropagation()
              setOpen(false)
            }
          }}
          placeholder="이름 또는 이메일"
          role="combobox"
          aria-expanded={open && items.length > 0}
          aria-autocomplete="list"
          data-testid={`${testid}-input`}
          className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none transition placeholder:text-muted-foreground focus:border-ring focus:ring-3 focus:ring-ring/20"
        />
        {open && items.length > 0 && (
          <ul
            role="listbox"
            className="absolute right-0 left-0 z-50 mt-1 max-h-60 overflow-y-auto rounded-lg border bg-popover p-1 shadow-lg"
          >
            {items.map((m, i) => (
              <li key={m.sub} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => void pick(m)}
                  data-testid={`${testid}-option-${m.sub}`}
                  className={cn(
                    "w-full rounded-md px-2.5 py-1.5 text-left text-sm",
                    i === active ? "bg-muted" : "hover:bg-muted",
                  )}
                >
                  <span className="block font-medium">{m.name || m.email}</span>
                  {m.name && <span className="block text-xs text-muted-foreground">{m.email}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Button
        type="button"
        variant="outline"
        className="h-9 w-16"
        onClick={() => void submit()}
        disabled={busy || !(isEmail || active >= 0 || items.some((m) => m.email.toLowerCase() === query.toLowerCase()))}
        data-testid={`${testid}-add`}
      >
        추가
      </Button>
    </div>
  )
}
