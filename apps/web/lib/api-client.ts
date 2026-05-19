const TOKEN_STORAGE_KEY = 'mp_token'
const COOKIE_NAME = 'mp_token'

export class ApiError extends Error {
  status: number
  body: unknown
  constructor(status: number, message: string, body: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

function readTokenFromCookie(): string | null {
  if (typeof document === 'undefined') return null
  for (const part of document.cookie.split(';')) {
    const [rawName, ...rest] = part.trim().split('=')
    if (rawName === COOKIE_NAME && rest.length > 0) {
      return decodeURIComponent(rest.join('='))
    }
  }
  return null
}

function readTokenFromStorage(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY)
  } catch {
    return null
  }
}

export function getToken(): string | null {
  return readTokenFromCookie() ?? readTokenFromStorage()
}

export function setToken(token: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token)
  } catch {
    /* ignore quota / privacy mode errors */
  }
}

export function clearToken(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

type JsonBody = Record<string, unknown> | unknown[] | null

async function request<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  url: string,
  body?: JsonBody,
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  const res = await fetch(url, {
    method,
    headers,
    credentials: 'include',
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  const contentType = res.headers.get('content-type') ?? ''
  const isJson = contentType.includes('application/json')
  const payload: unknown = isJson ? await res.json().catch(() => null) : await res.text()

  if (!res.ok) {
    const message =
      (isJson && payload && typeof payload === 'object' && 'message' in payload
        ? String((payload as { message: unknown }).message)
        : null) ?? `Request failed with status ${res.status}`
    throw new ApiError(res.status, message, payload)
  }

  return payload as T
}

export function get<T>(url: string): Promise<T> {
  return request<T>('GET', url)
}

export function post<T>(url: string, body?: JsonBody): Promise<T> {
  return request<T>('POST', url, body ?? null)
}

export function patch<T>(url: string, body?: JsonBody): Promise<T> {
  return request<T>('PATCH', url, body ?? null)
}

export function del<T>(url: string): Promise<T> {
  return request<T>('DELETE', url)
}
