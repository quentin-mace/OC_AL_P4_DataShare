const units = ['o', 'Ko', 'Mo', 'Go']

// Sans séparateur de milliers : en français il s'agit d'une espace insécable,
// et une valeur ne dépasse jamais 1023 dans son unité.
const number = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1, useGrouping: false })

/** Taille lisible, en unités binaires comme les maquettes ("2,6 Mo"). */
export function formatFileSize(bytes: number): string {
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${number.format(value)} ${units[unit]}`
}
