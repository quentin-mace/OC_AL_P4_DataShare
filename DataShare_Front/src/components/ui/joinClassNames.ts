/** Concatène des classes en ignorant les valeurs fausses (conditions non remplies). */
export function joinClassNames(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}
