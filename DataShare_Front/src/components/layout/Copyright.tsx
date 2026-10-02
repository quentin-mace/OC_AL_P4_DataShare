// Calculée une fois au chargement du module, pas à chaque rendu : la valeur
// reste stable d'un rendu à l'autre, ce que la règle react(purity) exige.
const currentYear = new Date().getFullYear()

export function Copyright({ className }: { className?: string }) {
  return <footer className={className}>Copyright DataShare® {currentYear}</footer>
}
