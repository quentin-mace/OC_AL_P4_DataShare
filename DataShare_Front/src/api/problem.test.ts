import { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { describe, expect, it } from 'vitest'
import { getStatus, getViolations } from './problem'

const config = { headers: {} } as InternalAxiosRequestConfig

function httpError(status: number, data: unknown) {
  return new AxiosError('Request failed', undefined, config, null, {
    data,
    status,
    statusText: '',
    headers: {},
    config,
  })
}

describe('getViolations', () => {
  it('returns the violations of a 422 response', () => {
    const violations = [
      { propertyPath: 'email', message: 'This value is not a valid email address.' },
    ]

    expect(getViolations(httpError(422, { status: 422, violations }))).toEqual(violations)
  })

  it('ignores other statuses', () => {
    expect(getViolations(httpError(400, { violations: [] }))).toBeNull()
  })

  it('ignores a 422 without a violations list', () => {
    expect(getViolations(httpError(422, { detail: 'Unprocessable' }))).toBeNull()
  })

  it('ignores errors that are not HTTP responses', () => {
    expect(getViolations(new Error('Network Error'))).toBeNull()
  })
})

describe('getStatus', () => {
  it('returns the status of an HTTP error', () => {
    expect(getStatus(httpError(429, {}))).toBe(429)
  })

  it('returns null when no response came back', () => {
    expect(getStatus(new AxiosError('Network Error', 'ERR_NETWORK', config))).toBeNull()
    expect(getStatus(new Error('boom'))).toBeNull()
  })
})
