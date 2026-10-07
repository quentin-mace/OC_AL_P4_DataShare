# Guide de l'interface

Ce guide dit comment construire un écran du front-end DataShare à partir des maquettes (`docs/mockUp`) sans réinventer ce qui existe déjà. Il complète le code : la source qui fait foi reste `DataShare_Front/src/index.css` pour les tokens et `DataShare_Front/src/components/` pour les composants.

## Principes

1. **Les maquettes d'abord.** Un écran reproduit sa maquette desktop et mobile. Quand la maquette ne dit rien (survol, focus, erreur d'un champ), on reprend le comportement d'un composant existant plutôt que d'en inventer un.
2. **Tokens, jamais de valeur en dur.** Une couleur, un rayon ou une ombre passe par un token du thème (`bg-accent-soft`, `rounded-card`). Pas de `bg-[#ffefe4]` ni de couleur de la palette Tailwind par défaut (`bg-orange-100`) : un changement de charte doit se faire en un seul endroit.
3. **Composant avant classes.** Avant d'écrire un `<button className="...">`, utiliser `Button`. Si trois écrans répètent le même assemblage de classes, il mérite un composant.
4. **Accessible par construction.** Éléments HTML natifs (`<button>`, `<select>`, `<input type="radio">`) plutôt que des `<div>` cliquables, chaque champ a un label, et tout est utilisable au clavier. React n'apporte aucun garde-fou, le plugin oxlint `jsx-a11y` en apporte quelques-uns.

## Tokens de design

Définis dans le bloc `@theme` de `src/index.css`, ils génèrent les classes Tailwind correspondantes (`bg-*`, `text-*`, `border-*`, `from-*`...). Les noms décrivent un **rôle**, pas une teinte.

### Couleurs

| Rôle | Tokens | Usage |
|---|---|---|
| Marque | `brand-from`, `brand-to` | dégradé vertical des pages publiques et de la sidebar : `bg-linear-to-b from-brand-from to-brand-to` |
| Texte | `ink`, `ink-muted`, `placeholder` | `ink` pour les titres et les noms de fichiers, `ink-muted` pour les labels et le texte courant |
| Sombre | `dark`, `upload` | `dark` pour les boutons pleins sombres, `upload` pour le rond d'upload de l'accueil uniquement |
| Accent | `accent`, `accent-strong`, `accent-soft`, `accent-border` | liens et actions : texte `accent`, bouton teinté en `accent-soft` + `accent-border` + `accent-strong` |
| Sélection | `coral` | option active du `Switch` |
| Surfaces | `surface`, `canvas`, `canvas-strong` | `surface` (blanc) pour les cartes et les champs, `canvas` pour le fond de l'espace personnel, `canvas-strong` pour sa barre du haut |
| Listes | `row`, `row-border`, `line` | `row` et `row-border` pour une ligne de fichier, `line` pour la bordure des champs |
| États | `disabled`, `disabled-ink`, `danger` | élément désactivé, statut "Expiré" et erreur d'un champ |
| Messages | `info-*`, `warning-*`, `error-*` | réservés au `Callout`, chacun en `-soft` (fond), `-border` et `-ink` (texte) |

### Typographie

Police unique, **DM Sans** (version variable, auto-hébergée par `@fontsource-variable/dm-sans`, aucun appel à Google Fonts). Elle est appliquée au `body`, il n'y a rien à ajouter.

| Élément | Classes |
|---|---|
| Logo "DataShare" | `text-2xl font-bold` |
| Titre de page (`h1`) | `text-2xl font-bold text-ink` |
| Titre de carte | `text-xl font-bold text-ink` |
| Texte courant, label | `text-sm` |
| Texte secondaire (taille de fichier, mention d'expiration) | `text-xs` |

Un écran a un seul `h1`, et les niveaux de titre se suivent sans saut.

### Formes

| Token | Valeur | Usage |
|---|---|---|
| `rounded-control` | 6 px | boutons, champs, callouts, lignes de liste |
| `rounded-card` | 12 px | cartes (formulaires centrés des pages publiques) |
| `rounded-full` | | `Switch`, bouton rond d'upload |
| `shadow-card` | ombre légère | cartes posées sur le dégradé |

## Gabarits de page

Une page ne dessine ni en-tête ni pied de page : elle est rendue dans un gabarit choisi par la route (`src/routes/routes.tsx`).

| Gabarit | Pages | Contenu |
|---|---|---|
| `PublicLayout` | accueil, connexion, inscription, téléchargement, 404 | dégradé de marque, `Header`, contenu centré, copyright (desktop seulement) |
| `DashboardLayout` | espace personnel | sidebar en dégradé (desktop seulement), barre du haut, fond `canvas` |

Les pages publiques présentent leur contenu dans une carte. Il n'existe pas encore de composant `Card`, l'assemblage à utiliser est :

```tsx
<section className="w-full max-w-md rounded-card bg-surface p-6 shadow-card">
  <h1 className="mb-4 text-center text-xl font-bold text-ink">Connexion</h1>
  ...
</section>
```

Les URLs ne s'écrivent jamais à la main : `paths.login`, `paths.download(token)` (`src/routes/paths.ts`).

## Composants

Tous dans `src/components/ui/`, sauf `Header` et les gabarits dans `src/components/layout/`.

### Button

```tsx
import { CloudUpload } from 'lucide-react'
import { Button } from '../components/ui/Button'

<Button variant="tinted" fullWidth leadingIcon={<CloudUpload className="size-4" />}>
  Téléverser
</Button>
```

| Variante | Quand l'utiliser | Exemples des maquettes |
|---|---|---|
| `tinted` (défaut) | action principale d'une carte ou d'un formulaire, une seule par écran | Téléverser, Connexion, Créer mon compte, Télécharger, Copier le lien |
| `outline` | action secondaire, souvent répétée dans une liste | Supprimer, Accéder, Changer |
| `ghost` | action discrète, sans cadre | Déconnexion |
| `dark` | action de l'en-tête | Se connecter, Mon espace, Ajouter des fichiers |

| Taille | Usage |
|---|---|
| `sm` | en-tête, lignes de liste |
| `md` (défaut) | cartes et formulaires, avec `fullWidth` dans un formulaire |

- `type="button"` par défaut. Le bouton qui soumet un formulaire doit le dire : `type="submit"`.
- Désactiver avec `disabled`, la variante applique d'elle-même le style désactivé de la maquette.
- Les icônes passent par `leadingIcon` et `trailingIcon`, qui les masquent aux lecteurs d'écran. Un bouton avec une icône seule (menu "...", mobile) doit porter un `aria-label`.

**Un lien qui navigue reste un lien.** "Se connecter" ou "Créer un compte" changent de page : ce sont des `<Link>` habillés en bouton, pas des `Button` avec un `onClick` qui navigue.

```tsx
<Link to={paths.login} className={buttonStyles({ variant: 'dark', size: 'sm' })}>
  Se connecter
</Link>
```

### Input et Select

```tsx
<Input label="Email" type="email" placeholder="Saisissez votre email..." error={errors.email?.message} {...register('email')} />

<Select
  label="Expiration"
  options={[{ value: '1', label: 'Une journée' }, { value: '7', label: 'Une semaine' }]}
  {...register('expiresInDays')}
/>
```

- `label` est obligatoire et visible, comme sur les maquettes. Le placeholder ne remplace jamais un label.
- `error` affiche le message sous le champ, passe le champ en rouge et le relie au champ pour les lecteurs d'écran (`aria-invalid`, `aria-describedby`). C'est le point de branchement des erreurs zod et des `violations` renvoyées par l'API.
- `ref` est une prop (React 19) : `{...register('email')}` de react-hook-form se branche directement.
- L'`id` est généré automatiquement, n'en passer un que si un autre élément doit pointer vers le champ.

### Callout

```tsx
<Callout variant="warning">Ce fichier expirera demain.</Callout>
```

| Variante | Usage | Annonce aux lecteurs d'écran |
|---|---|---|
| `info` (défaut) | information neutre (durée de vie restante) | à la prochaine pause (`role="status"`) |
| `warning` | échéance proche | à la prochaine pause (`role="status"`) |
| `error` | action impossible (lien expiré, mot de passe faux) | immédiatement (`role="alert"`) |

Un callout est un message en réponse à une situation, pas une décoration. Pour un champ invalide, utiliser `error` sur le champ plutôt qu'un callout.

### Switch

Sélecteur segmenté, pour choisir **une** valeur parmi quelques-unes visibles en permanence (filtre Tous / Actifs / Expiré).

```tsx
const [filter, setFilter] = useState<'all' | 'active' | 'expired'>('all')

<Switch
  label="Filtrer les fichiers"
  options={[
    { value: 'all', label: 'Tous' },
    { value: 'active', label: 'Actifs' },
    { value: 'expired', label: 'Expiré' },
  ]}
  value={filter}
  onChange={setFilter}
/>
```

Composant contrôlé : l'état vit dans la page. Le `label` n'est pas affiché mais annoncé, il doit dire ce que l'on filtre. Construit sur des boutons radio natifs, il se pilote aux flèches du clavier.

### Header

`<Header isAuthenticated={...} />` affiche "Se connecter" à un visiteur et "Mon espace" à un utilisateur connecté. Il est déjà inclus dans `PublicLayout`, une page n'a pas à l'ajouter.

## Formulaires

Un formulaire associe un schéma zod (`src/validation/`) à react-hook-form, comme `RegisterPage` :

```tsx
const { register, handleSubmit, setError, formState: { errors, isSubmitting } } =
  useForm<RegisterFormInput, unknown, RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    mode: 'onTouched',
  })
```

- **Le schéma reproduit les contraintes du back, sans s'y substituer.** Il évite un aller-retour, la validation serveur reste seule à faire foi. Une règle portée du back cite sa source (ex. `validation/passwordStrength.ts`, portage de `PasswordStrength`).
- **`mode: 'onTouched'`.** Un champ n'est jugé qu'après avoir été quitté une première fois, puis à chaque frappe. L'utilisateur n'est pas interrompu pendant sa première saisie.
- **Messages en français, écrits par le front.** Les messages de l'API sont en anglais : on ne les affiche jamais tels quels.
- **Erreurs serveur.** `getViolations(error)` (`src/api/problem.ts`) renvoie les `violations` d'un 422, `null` sinon. Chaque violation passe par `setError(propertyPath, ...)`, avec un libellé choisi d'après son `code` (code de la contrainte Symfony) ou, à défaut, d'après le champ. Toute autre erreur (réseau, 5xx) s'affiche dans un `Callout variant="error"` au-dessus du bouton.
- `noValidate` sur le `<form>` : la validation native du navigateur ferait doublon avec zod, et avec d'autres messages.
- `autoComplete` renseigné sur chaque champ (`email`, `given-name`, `new-password`...) pour les gestionnaires de mots de passe.

## Icônes

Jeu **Lucide** (`lucide-react`), celui que les maquettes reprennent. Chaque icône s'importe seule, seules celles utilisées partent dans le bundle.

```tsx
import { Trash2 } from 'lucide-react'

<Trash2 aria-hidden="true" className="size-4" />
```

- Taille par `size-*`, couleur héritée du texte (`currentColor`), donc aucune classe de couleur à ajouter en général.
- Une icône à côté d'un texte est décorative : `aria-hidden="true"` (fait par `Button` et `Callout`). Une icône seule porteuse de sens a besoin d'un texte alternatif.

| Besoin | Icône |
|---|---|
| Upload, téléchargement | `CloudUpload` |
| Supprimer | `Trash2` |
| Accéder | `ArrowRight` |
| Fichier protégé | `Lock` |
| Copier le lien | `Copy` |
| Déconnexion | `LogOut` |
| Callouts | `Info`, `TriangleAlert`, `CircleAlert` |

## Responsive

Mobile d'abord : les classes sans préfixe visent le mobile, `md:` (768 px) bascule vers la maquette desktop. Exemples déjà en place : copyright masqué sur mobile (`hidden md:block`), sidebar de l'espace personnel masquée sur mobile (`hidden md:flex`).

## Accessibilité

Le minimum attendu sur chaque écran :

- **Clavier.** Tout ce qui se clique s'atteint à la touche Tab, dans l'ordre de lecture, avec un focus visible (fourni par `Button` et les champs). Ne jamais retirer un `outline` sans le remplacer.
- **Labels.** Chaque champ a un label, chaque bouton ou lien un nom lisible (pas "cliquez ici").
- **Langue.** `lang="fr"` est posé sur la page, les textes de l'interface sont en français.
- **Tests.** Les tests trouvent les éléments par leur rôle et leur nom (`getByRole('button', { name: 'Téléverser' })`), ce qui vérifie au passage qu'ils sont accessibles.

### Écart connu : contrastes de la maquette

Plusieurs couples de couleurs des maquettes sont sous le seuil WCAG AA (4,5:1 pour le texte courant, 3:1 pour le texte de grande taille). Les tokens les reproduisent fidèlement. Ce choix est provisoire, à arbitrer avec le design avant la mise en production.

| Couple | Contraste | Usage |
|---|---|---|
| `accent` sur `surface` / `canvas` / `row` | 2,7 à 2,9 | liens, boutons `outline` et `ghost` |
| `white` sur `coral` | 2,8 | option active du `Switch` |
| `accent-strong` sur `accent-soft` | 3,7 | bouton `tinted` |
| `warning-ink` sur `warning-soft` | 4,3 | callout `warning` |
| `white` sur `brand-to` | 3,5 | copyright en bas du dégradé |
| `placeholder` sur `surface` | 2,1 | placeholder des champs |

Les couples `ink-muted` sur `surface` (16,7), `white` sur `dark` (14), `info-ink`, `error-ink` et `danger` (4,98 à 8,6) sont conformes. Les éléments désactivés ne sont pas soumis au seuil.

Foncer `accent` et `coral` suffirait à corriger l'essentiel, en changeant deux lignes de `src/index.css`. C'est l'intérêt des tokens sémantiques.

## Ajouter un composant

1. Vérifier qu'aucun composant existant ne couvre le besoin, éventuellement avec une variante de plus.
2. Le placer dans `components/ui/` s'il est générique (ne connaît ni les routes ni l'API), dans `components/layout/` sinon.
3. Partir d'un élément HTML natif, accepter `className` et les props natives utiles, n'utiliser que des tokens.
4. Écrire son test à côté (`Composant.test.tsx`), en vérifiant le comportement visible : rôle, nom accessible, réaction au clic et au clavier.
5. L'ajouter à ce guide.
