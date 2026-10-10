"use client"

import { useEffect, useState } from "react"
import { Download, X } from "lucide-react"
import QRCode from "qrcode"

interface Props {
  url: string
  title: string
  onClose: () => void
}

/**
 * 공개 URL 의 QR 코드 모달: 부스 출력과 인쇄 용. PNG 다운로드 버튼.
 */
export function QrModal({ url, title, onClose }: Props) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let aborted = false
    QRCode.toDataURL(url, { width: 512, margin: 2 })
      .then((d) => !aborted && setDataUrl(d))
      .catch((e: Error) => !aborted && setError(e.message))
    return () => {
      aborted = true
    }
  }, [url])

  function download() {
    if (!dataUrl) return
    const a = document.createElement("a")
    a.href = dataUrl
    a.download = `${title.replace(/[^a-z0-9가-힣]+/gi, "_")}_qr.png`
    a.click()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      data-testid="qr-modal"
    >
      <div
        className="w-full max-w-sm rounded-lg bg-card p-6 shadow-xl dark:ring-1 dark:ring-foreground/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="min-w-0 truncate text-sm font-semibold text-foreground">{title} QR 코드</h3>
          <button
            onClick={onClose}
            data-testid="qr-modal-close"
            className="rounded p-1 text-muted-foreground hover:bg-muted"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col items-center gap-3">
          {error && (
            <p className="text-xs text-rose-600 dark:text-rose-400">QR 생성 실패: {error}</p>
          )}
          {dataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={dataUrl}
              alt="QR"
              data-testid="qr-modal-image"
              className="h-64 w-64 rounded border border-border"
            />
          ) : (
            <div className="h-64 w-64 animate-pulse rounded bg-muted" />
          )}
          <p className="break-all text-center text-xs text-muted-foreground">{url}</p>
          <button
            onClick={download}
            disabled={!dataUrl}
            data-testid="qr-modal-download"
            className="inline-flex items-center gap-1 rounded bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Download size={14} /> PNG 다운로드
          </button>
        </div>
      </div>
    </div>
  )
}
