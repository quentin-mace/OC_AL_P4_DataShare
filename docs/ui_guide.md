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
| `DashboardLayout` | espace personnel | sidebar en dégradé (desktop), menu repliable ouvert par un burger (mobile), barre du haut, fond `canvas` |

Les pages publiques présentent leur contenu dans une carte. Il n'existe pas encore de composant `Card`, l'assemblage à utiliser est :

```tsx
<section className="w-full max-w-md rounded-card bg-surface p-6 shadow-card">
  <h1 className="mb-4 text-center text-xl font-bold text-ink">Connexion</h1>
  ...
</section>
```

Les URLs ne s'écrivent jamais à la main : `paths.login`, `paths.download(token)` (`src/routes/paths.ts`).

## Composants

Tous dans `src/components/ui/`, sauf `Header` et les gabarits dans `src/components/layout/`, et les composants propres à une fonctionnalité, rangés par domaine (`upload/`, `files/`).

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
- Curseur main et survol sont fournis par `buttonStyles`, sur les boutons actifs seulement. Tailwind 4 ne met plus de curseur main sur un `<button>` : un bouton écrit sans `buttonStyles` en serait privé.
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
| `success` | action réussie (fichier supprimé) | à la prochaine pause (`role="status"`) |
| `warning` | échéance proche | à la prochaine pause (`role="status"`) |
| `error` | action impossible (lien expiré, mot de passe faux) | immédiatement (`role="alert"`) |

La maquette ne dessine que `info`, `warning` et `error`. `success` en reprend la construction (fond pâle, bordure, texte et icône foncés), en vert, avec l'icône `CircleCheck`.

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

### Tag

```tsx
<Tag name="facture" />
<Tag name="facture" onClick={() => setTagFilter('facture')} clickLabel="Filtrer sur le tag facture" />
<Tag name="facture" onRemove={clearFilter} removeLabel="Retirer le filtre sur le tag facture" />
```

Pastille d'un tag (US08), en `accent-soft` bordé d'`accent-border`, comme le bouton `tinted`. Aucune maquette ne dessine de tags : la pastille reprend les tokens existants sans en créer.

- Sans `onClick`, simple texte. Avec, un `<button>` dont `clickLabel` donne le nom accessible : il doit contenir le nom du tag, que l'utilisateur voit et peut dicter.
- `disabled` désactive la pastille cliquable, par exemple pendant une requête.
- `onRemove` ajoute une croix, bouton distinct nommé par `removeLabel` (par défaut "Retirer facture").
- Un nom long est tronqué à la largeur disponible, et reste lisible en entier au survol (`title`).

### Modal

Fenêtre modale sur `<dialog>` natif, ouverte par `showModal()` : le focus y reste piégé, l'arrière-plan devient inerte, Échap la ferme et le focus revient au bouton d'origine.

```tsx
const [open, setOpen] = useState(false)

<Modal open={open} title="Ajouter un fichier" onClose={() => setOpen(false)}>
  ...
</Modal>
```

- Composant contrôlé : Échap et le bouton "Fermer" appellent `onClose`, c'est le parent qui passe `open` à `false`.
- `title` devient le titre (`h2`) et le nom accessible de la modale.
- Fermée, la modale n'est pas rendue : son contenu repart de zéro à chaque ouverture.
- Une demande de confirmation passe `role="alertdialog"` et `descriptionId`, l'`id` du message qui la décrit, annoncé après le titre (voir `DeleteFileDialog`).
- `initialFocus` désigne l'élément focalisé à l'ouverture, par défaut le bouton "Fermer". Une confirmation destructrice le pose sur "Annuler", le choix sans conséquence. `autoFocus` ne convient pas : React l'applique avant `showModal()`, qui le remplace.
- Dans les tests, jsdom n'implémente pas `showModal()` : `src/test/setup.ts` le remplace par la simple pose de l'attribut `open`. La touche Échap se simule avec un événement `cancel` sur la modale.

### FileField

Choix d'un fichier, dessiné comme la maquette : icône, nom, taille ("2,6 Mo", via `formatFileSize` de `src/format/fileSize.ts`) et bouton "Changer". Tant qu'aucun fichier n'est choisi, un bouton "Choisir un fichier" en tient lieu.

```tsx
<Controller
  control={control}
  name="file"
  render={({ field }) => (
    <FileField label="Fichier" file={field.value} onChange={field.onChange} onBlur={field.onBlur} error={errors.file?.message} />
  )}
/>
```

- Composant contrôlé, branché par `Controller` de react-hook-form et non par `register` : la valeur est un `File`, pas le texte d'un champ.
- L'`<input type="file">` natif reste dans la page, masqué : c'est lui qui ouvre le sélecteur du système, et c'est sur lui que les tests déposent un fichier (`userEvent.upload(screen.getByLabelText('Fichier'), file)`).
- `label` n'est pas affiché (la maquette n'en dessine pas) mais annoncé. `error` est relié au champ et aux boutons.

### ProgressBar

```tsx
<ProgressBar label="Envoi en cours" value={progress} />
```

Barre d'avancement de 0 à 100 sur `<progress>` natif, avec le pourcentage affiché à droite du libellé. Pour un envoi, la valeur vient de `onUploadProgress` d'axios (voir `uploadFile` dans `src/api/files.ts`).

### FileSummary

```tsx
<FileSummary name={file.name} size={file.size} />
```

Icône `FileText`, nom et taille lisible (`formatFileSize`) d'un fichier, sur la carte de fin d'upload comme sur la page de téléchargement. Un nom trop long est tronqué, et reste lisible en entier au survol (`title`).

### UploadDialog

```tsx
<UploadDialog open={open} onClose={() => setOpen(false)} withTags={isAuthenticated} />
```

Modale d'envoi (`src/components/upload/`), ouverte par "Ajouter des fichiers" dans l'espace personnel et par le bouton rond de l'accueil. Elle enchaîne le formulaire puis le lien de partage.

- `withTags` (vrai par défaut) affiche le champ Tags. L'accueil le passe à faux pour un visiteur : l'API refuse les tags d'un envoi anonyme (voir `anonymous_upload.md`). Un utilisateur connecté garde ses tags, son envoi est rattaché à son compte.
- Un 401 affiche "Votre session a expiré, reconnectez-vous." Sur l'accueil, aucune garde ne quitte la page : le champ Tags disparaît et l'envoi suivant part en anonyme.
- Écart connu : la maquette mobile de l'accueil dessine une feuille ancrée en bas d'écran, la modale reste centrée comme dans l'espace personnel.

### FileRow

```tsx
<ul aria-labelledby={headingId} className="flex flex-col gap-3">
  {files.map((file) => (
    <FileRow
      key={file.id}
      file={file}
      onDelete={setToDelete}
      onEditTags={(file) => setEditingId(file.id)}
      onTagSelect={changeTagFilter}
    />
  ))}
</ul>
```

Ligne de l'historique (`src/components/files/`), à poser dans une liste `<ul>`. Elle reçoit un fichier de `GET /files` et affiche l'icône de son type (`FileTypeIcon`), son nom tronqué, son échéance (`expirationLabel`) ou "Expiré", ses tags, un cadenas s'il a un mot de passe, un bouton "Tags", un bouton "Supprimer" et un lien "Accéder" vers sa page de téléchargement. Une ligne expirée n'a pas de lien.

Les tags sont une liste (`<ul aria-label="Tags">`) de pastilles `Tag` cliquables : un clic appelle `onTagSelect` avec le nom du tag, et la page filtre l'historique sur lui. Chaque ligne contenant sa propre liste, la liste de l'historique est nommée par le titre de la page (`aria-labelledby`), ce qui permet de l'atteindre sans ambiguïté, en test comme au lecteur d'écran.

"Supprimer" appelle `onDelete` avec le fichier, sans rien supprimer : la confirmation revient à la page (`DeleteFileDialog`). Il figure aussi sur une ligne expirée, contrairement à la maquette desktop, qui le réserve aux fichiers actifs : c'est le seul moyen de retirer de l'historique un fichier dont l'objet a été purgé, l'historique n'étant borné par rien d'autre (voir `architectureDecisions/auto_expiration.md`). L'état actif ou expiré est celui renvoyé par l'API (`status`), pas recalculé dans le navigateur.

### DeleteFileDialog

```tsx
const [toDelete, setToDelete] = useState<FileHistoryItem | null>(null)

<DeleteFileDialog file={toDelete} onClose={() => setToDelete(null)} onDeleted={handleDeleted} />
```

Confirmation de suppression (US06, `src/components/files/`), construite sur `Modal` en `alertdialog` : le titre "Supprimer ce fichier ?" la nomme, le message la décrit. Il dépend de l'état du fichier : un fichier actif sera supprimé définitivement et son lien ne fonctionnera plus, un fichier expiré, qui n'a plus d'objet stocké ni de lien, ne sera simplement plus affiché dans l'historique.

- Ouverte tant que `file` n'est pas `null`. Le focus arrive sur "Annuler", le choix sans conséquence, et revient au bouton d'origine si l'utilisateur renonce.
- Elle appelle elle-même `deleteFile`, pour qui un 404 vaut succès : le fichier n'existe déjà plus. Toute autre erreur s'affiche dans la modale, qui reste ouverte, et le focus revient sur "Annuler".
- Pendant la requête, les boutons sont désactivés et la modale ne se ferme pas (Échap compris) : fermer laisserait croire à une annulation.
- `onDeleted` ne ferme pas la modale. Le parent retire le fichier de sa liste, ferme, puis place le focus : le bouton qui avait ouvert la modale a disparu avec sa ligne.

### EditTagsDialog

```tsx
const [editingId, setEditingId] = useState<number | null>(null)
const editing = files.find(({ id }) => id === editingId) ?? null

<EditTagsDialog
  file={editing}
  accountTags={accountTags}
  onClose={closeTags}
  onTagsChanged={handleTagsChanged}
/>
```

Édition des tags d'un fichier (US08, `src/components/files/`), ouverte par le bouton "Tags" d'une ligne de l'historique, active ou expirée. Elle liste les tags du fichier, chacun avec "Renommer" et "Retirer", et propose un champ "Ajouter un tag".

- **Tags déjà utilisés.** Sous le champ d'ajout, les tags du compte que le fichier ne porte pas encore, en pastilles : un clic ajoute le tag, sans saisie. `accountTags` est l'union des tags de l'historique, triée (`localeCompare` en `fr`). Elle est exacte sans appel dédié, puisque l'historique est chargé en entier et qu'un tag n'existe que tant qu'un fichier le porte (voir `architectureDecisions/tags.md`). Après le clic, le focus va au champ d'ajout : la pastille a disparu (succès) ou était désactivée (échec).

- **Chaque action part aussitôt** (`addTag`, `renameTag`, `removeTag` de `src/api/files.ts`), il n'y a rien à enregistrer en fermant. La liste affichée est celle que renvoie l'API (`{ id, tags }`), remontée par `onTagsChanged` : la page met à jour la ligne sans recharger l'historique. La modale reçoit donc le fichier tiré de la liste de la page, par identifiant, et non une copie figée à l'ouverture.
- **Validation** par `tagSchema` (`src/validation/tagSchema.ts`) : tag non vide, 30 caractères au plus, sans virgule (le séparateur de l'envoi), sans "/" et absent du fichier. Le "/" est une restriction propre au front, appliquée aussi à l'envoi : le back l'accepte, mais un tag qui en contient un n'est plus adressable par `/files/{id}/tags/{tag}`, donc ni renommable ni retirable (voir `architectureDecisions/tags.md`). Un 422 s'affiche sur le champ, un 404 (fichier ou tag disparu depuis un autre onglet) et toute autre erreur dans un `Callout`. Contrairement à la règle des formulaires (`onTouched`), la validation se fait à la soumission (`mode: 'onSubmit'`), puis à chaque frappe une fois l'erreur affichée : le champ d'ajout a le focus dès l'ouverture, et le quitter vide pour cliquer ailleurs n'est pas une erreur. Le message qui apparaîtrait décalerait aussi la modale sous le pointeur, si bien que le clic visé (une suggestion, "Retirer") tomberait à côté.
- **Renommage en ligne.** Le champ s'ouvre sur le nom actuel, sélectionné. Entrée valide, Échap ou "Annuler" rendent la ligne sans fermer la modale. Un nom inchangé n'appelle pas l'API. Le renommage ne vaut que pour ce fichier, comme la route.
- **Focus.** À l'ouverture, sur le champ d'ajout, qui le garde après un ajout pour enchaîner les tags. Après un renommage, sur le bouton "Renommer" du tag renommé ; après un retrait, sur le champ d'ajout, la ligne ayant disparu. Pendant la requête, les champs passent en `readOnly` plutôt qu'en `disabled`, qui leur ferait perdre le focus.
- Pendant la requête, les boutons sont désactivés et la modale ne se ferme pas (Échap compris).
- À la fermeture, si la ligne du fichier n'est plus affichée (elle ne porte plus le tag filtré), la page place le focus sur son titre, comme après une suppression. Un tag qui ne porte plus aucun fichier retire de lui-même le filtre posé sur lui.

### Header

`<Header isAuthenticated={...} />` affiche "Se connecter" à un visiteur et "Mon espace" à un utilisateur connecté. Il est déjà inclus dans `PublicLayout`, qui lui passe l'état de connexion : une page n'a pas à l'ajouter.

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

## Authentification

L'état de connexion vit dans un store zustand, `src/auth/authStore.ts`. Le token y est la seule donnée, persistée en `localStorage` (voir `tech_stack.md`, "Stockage du JWT").

| Besoin | Outil |
|---|---|
| Savoir si l'utilisateur est connecté | `useIsAuthenticated()`, faux dès que le token est expiré |
| Ouvrir ou fermer la session | `useAuthStore((auth) => auth.login)`, `useAuthStore((auth) => auth.logout)` |
| Réserver une route aux comptes | la placer sous `RequireAuth` dans `src/routes/routes.tsx` |

- **Aucun appel ne pose le token à la main.** Le store le prête au client axios (`setTokenProvider`), qui l'ajoute en `Authorization: Bearer` sur toute requête. Un token expiré n'est jamais envoyé : la session prend fin et la requête part sans en-tête.
- **Un 401 ne déconnecte que s'il répond à une requête authentifiée.** `POST /login` (identifiants faux) et `POST /downloads/{token}` (mot de passe du fichier faux) renvoient aussi 401 : ces erreurs restent à l'appelant. Sur une requête qui portait le token, l'intercepteur ferme la session avec `sessionExpired`, la garde renvoie vers la connexion, qui affiche "Votre session a expiré".
- **Une route publique s'appelle avec `skipAuth: true`.** Le token n'y est pas envoyé, si bien qu'un 401 de la route ne peut pas déconnecter un visiteur connecté. C'est le cas des deux appels de `src/api/downloads.ts`. Sans cette option, un mauvais mot de passe de fichier fermerait la session de l'utilisateur.
- **La garde garde la page demandée.** `RequireAuth` redirige vers `paths.login` avec `state.from`, et la page de connexion y ramène l'utilisateur une fois connecté (à défaut, vers `paths.files`).
- **Pour tester un écran réservé**, poser un token valable avant le rendu : `useAuthStore.setState({ token: fakeToken(3600) })` (`src/test/jwt.ts`), et remettre le store à zéro dans `afterEach`.

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
| Supprimer, retirer un tag | `Trash2` |
| Tags d'un fichier | `Tag` (importée sous le nom `TagIcon`, `Tag` étant le composant) |
| Renommer | `Pencil` |
| Ajouter un tag | `Plus` |
| Valider une saisie en ligne | `Check` |
| Accéder | `ArrowRight` |
| Fichier protégé | `Lock` |
| Copier le lien | `Copy` |
| Fichier (sélection, lien créé, téléchargement) | `FileText` |
| Type de fichier dans l'historique | `FileImage`, `FileMusic`, `FilePlay`, `FileText` par défaut (`FileTypeIcon`) |
| Fermer une modale, retirer un filtre | `X` |
| Déconnexion | `LogOut` |
| Callouts | `Info`, `TriangleAlert`, `CircleAlert` |

## Responsive

Mobile d'abord : les classes sans préfixe visent le mobile, `md:` (768 px) bascule vers la maquette desktop. Exemples déjà en place : copyright masqué sur mobile (`hidden md:block`), sidebar de l'espace personnel masquée sur mobile (`hidden md:flex`) et remplacée par `MobileMenu`, un `<dialog>` latéral ouvert par le burger (`md:hidden`). Les liens de navigation vivent dans `SidebarNav`, partagé par les deux : un lien ajouté à l'espace personnel s'ajoute là. Dans une ligne de l'historique, les libellés "Tags", "Supprimer" et "Accéder" ne sont visibles qu'à partir de `md:` (`sr-only md:not-sr-only`), l'étiquette, la corbeille et la flèche seules restent sur mobile. La maquette mobile regroupe ces actions derrière un bouton "⋮" : des boutons directs évitent un menu déroulant et son schéma clavier ARIA, pour trois actions seulement.

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

Les couples `ink-muted` sur `surface` (16,7), `white` sur `dark` (14), `info-ink`, `success-ink`, `error-ink` et `danger` (4,98 à 8,6) sont conformes. Les éléments désactivés ne sont pas soumis au seuil.

Foncer `accent` et `coral` suffirait à corriger l'essentiel, en changeant deux lignes de `src/index.css`. C'est l'intérêt des tokens sémantiques.

## Organisation du code

```
src/
├── api/                client axios (URL de base, injection du JWT)
├── auth/               stockage du jeton et lecture de son expiration
├── browser/            ce qui ne peut passer que par le navigateur (téléchargement)
├── components/
│   ├── ui/             composants génériques des maquettes (Button, Input, Select, Callout, Switch)
│   ├── layout/         gabarits de page, Header, Copyright
│   └── <domaine>/      composants propres à une fonctionnalité (files, upload)
├── format/             mise en forme des tailles et des dates
├── pages/              une page par écran
├── routes/             routes et URLs de l'application (paths.ts)
├── validation/         schémas zod des formulaires
└── test/               configuration de Vitest
```

## Ajouter un composant

1. Vérifier qu'aucun composant existant ne couvre le besoin, éventuellement avec une variante de plus.
2. Le placer dans `components/ui/` s'il est générique (ne connaît ni les routes ni l'API), dans `components/layout/` pour un gabarit, dans le dossier de sa fonctionnalité sinon (`components/files/`...).
3. Partir d'un élément HTML natif, accepter `className` et les props natives utiles, n'utiliser que des tokens.
4. Écrire son test à côté (`Composant.test.tsx`), en vérifiant le comportement visible : rôle, nom accessible, réaction au clic et au clavier.
5. L'ajouter à ce guide.
