/** 한국어 조사: 앞 말의 받침에 따라 을/를, 으로/로, 이/가 */

function batchim(word: string): { yes: boolean; rieul: boolean } {
  const c = word.trim().slice(-1)
  if (!c) return { yes: false, rieul: false }
  const code = c.charCodeAt(0)
  if (code >= 0xac00 && code <= 0xd7a3) {
    const j = (code - 0xac00) % 28
    return { yes: j !== 0, rieul: j === 8 }
  }
  if (/[0-9]/.test(c)) return { yes: "013678".includes(c), rieul: "178".includes(c) }
  const l = c.toLowerCase()
  return { yes: "lmnr".includes(l), rieul: "lr".includes(l) }
}

export const josaEul = (w: string) => (batchim(w).yes ? "을" : "를")

export const josaRo = (w: string) => {
  const b = batchim(w)
  return b.yes && !b.rieul ? "으로" : "로"
}

export const josaI = (w: string) => (batchim(w).yes ? "이" : "가")

/** "오전 2:00" 은 "두 시"로 읽으니 로 */
export const josaRoTime = (w: string) => (w.endsWith(":00") ? "로" : josaRo(w))
