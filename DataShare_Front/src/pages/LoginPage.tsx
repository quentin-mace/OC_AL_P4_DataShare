import { useLocation } from 'react-router'
import { Callout } from '../components/ui/Callout'

// Posé par la page d'inscription en redirigeant ici après un 201.
interface LoginLocationState {
  registered?: boolean
}

export function LoginPage() {
  const state = useLocation().state as LoginLocationState | null

  return (
    <>
      <h1 className="text-2xl font-bold text-ink">Connexion</h1>
      {state?.registered && <Callout>Compte créé, vous pouvez vous connecter.</Callout>}
    </>
  )
}
