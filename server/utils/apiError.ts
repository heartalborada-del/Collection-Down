const MAX_UPSTREAM_DETAIL_LENGTH = 500

function normalizeDetail(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const detail = value.replace(/\s+/g, ' ').trim()
    return detail ? detail.slice(0, MAX_UPSTREAM_DETAIL_LENGTH) : undefined
  }

  if (value === null || value === undefined) return undefined

  try {
    return JSON.stringify(value).slice(0, MAX_UPSTREAM_DETAIL_LENGTH)
  }
  catch {
    return String(value).slice(0, MAX_UPSTREAM_DETAIL_LENGTH)
  }
}

export function describeError(error: unknown, context: string): string {
  const detail = error instanceof Error ? error.message : normalizeDetail(error)
  return detail ? `${context}: ${detail}` : context
}

export async function describeUpstreamResponse(response: Response, service: string): Promise<string> {
  let detail: string | undefined

  try {
    const body = await response.clone().text()
    if (body) {
      try {
        const parsed = JSON.parse(body) as Record<string, unknown>
        detail = normalizeDetail(parsed.message ?? parsed.msg ?? parsed.error ?? parsed)
      }
      catch {
        detail = normalizeDetail(body)
      }
    }
  }
  catch {
    // Status information below is still useful when the upstream body cannot be read.
  }

  const status = `HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ''}`
  return detail ? `${service} request failed (${status}): ${detail}` : `${service} request failed (${status})`
}
