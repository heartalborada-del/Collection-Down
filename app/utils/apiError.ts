import type { ApiResponse } from '~~/types/api/root'

function getObjectMessage(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined

  const object = value as Record<string, unknown>
  const message = object.message ?? object.statusMessage ?? object.error
  return typeof message === 'string' && message.trim() ? message.trim() : undefined
}

export async function createApiResponseError(response: Response, operation: string): Promise<Error> {
  let detail: string | undefined

  try {
    const body = await response.clone().json() as ApiResponse<unknown>
    detail = getObjectMessage(body)
  }
  catch {
    try {
      const body = (await response.clone().text()).trim()
      if (body) detail = body.slice(0, 500)
    }
    catch {
      // The HTTP status below remains actionable when the body cannot be read.
    }
  }

  const status = `HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ''}`
  return new Error(detail ? `${operation}失败（${status}）：${detail}` : `${operation}失败（${status}）`)
}

export function getErrorMessage(error: unknown, fallback = '未知错误'): string {
  if (error instanceof Error && error.message.trim()) return error.message
  if (typeof error === 'string' && error.trim()) return error

  if (error && typeof error === 'object') {
    const object = error as Record<string, unknown>
    const message = getObjectMessage(object)
    const code = typeof object.code === 'number' ? `（错误码 ${object.code}）` : ''
    const category = typeof object.error === 'string' ? object.error : ''
    if (message) return `${category ? `${category}：` : ''}${message}${code}`
  }

  return fallback
}
