// apps/web/lib/ai/rate-limit.ts

const BURST_LIMIT = 10       // per minute
const DAILY_LIMIT = 100      // per day
const MINUTE_MS = 60_000
const DAY_MS = 86_400_000

interface BucketState {
  minuteTokens: number
  minuteLastRefill: number
  dayTokens: number
  dayLastRefill: number
}

// In-memory store — resets on cold start (acceptable for serverless burst protection)
const store = new Map<string, BucketState>()

export interface RateLimitResult {
  allowed: boolean
  reason?: string
  remaining: { minute: number; day: number }
}

export function checkRateLimit(apiKey: string): RateLimitResult {
  const now = Date.now()

  let state = store.get(apiKey)
  if (!state) {
    state = {
      minuteTokens: BURST_LIMIT,
      minuteLastRefill: now,
      dayTokens: DAILY_LIMIT,
      dayLastRefill: now,
    }
  }

  // Refill minute bucket
  if (now - state.minuteLastRefill >= MINUTE_MS) {
    const intervals = Math.floor((now - state.minuteLastRefill) / MINUTE_MS)
    state.minuteTokens = Math.min(BURST_LIMIT, state.minuteTokens + intervals * BURST_LIMIT)
    state.minuteLastRefill = now
  }

  // Refill day bucket
  if (now - state.dayLastRefill >= DAY_MS) {
    state.dayTokens = DAILY_LIMIT
    state.dayLastRefill = now
  }

  if (state.dayTokens <= 0) {
    store.set(apiKey, state)
    return { allowed: false, reason: 'Daily limit reached (100/day)', remaining: { minute: state.minuteTokens, day: 0 } }
  }

  if (state.minuteTokens <= 0) {
    store.set(apiKey, state)
    return { allowed: false, reason: 'Burst limit reached (10/min)', remaining: { minute: 0, day: state.dayTokens } }
  }

  state.minuteTokens -= 1
  state.dayTokens -= 1
  store.set(apiKey, state)

  return {
    allowed: true,
    remaining: { minute: state.minuteTokens, day: state.dayTokens },
  }
}
