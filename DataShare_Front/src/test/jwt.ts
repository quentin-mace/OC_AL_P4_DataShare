// Fabrique un JWT dont seul le payload compte : le front n'en lit que exp.
export function fakeToken(expiresInSeconds: number): string {
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds
  const encode = (value: object) =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({ exp, username: 'alice@example.com' })}.signature`
}
