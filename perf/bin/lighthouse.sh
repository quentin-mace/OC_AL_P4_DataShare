#!/usr/bin/env sh
#
# Mesures Lighthouse sur les pages publiques du front, servies par nginx
# depuis le build de production.
#
# Lance depuis le poste : le script demarre le serveur, pilote le conteneur
# Lighthouse, puis arrete le serveur. "make front" construit le bundle avant
# de l'appeler.
#
# Prerequis sur le poste : jq, pour le tableau de synthese.

set -eu

BASE_URL="http://localhost:5174"
RUNS="${RUNS:-3}"
OUT="results/lighthouse"

# Pages atteignables sans session, voir DataShare_Front/src/routes/paths.ts.
# "/files" est derriere RequireAuth et "/download/:token" demande un lien
# vivant : ni l'une ni l'autre ne se mesure sans jeu de donnees.
PAGES="home:/ login:/login register:/register"

export HOST_UID="${HOST_UID:-$(id -u)}"
export HOST_GID="${HOST_GID:-$(id -g)}"

DC="docker compose --profile perf"

if ! command -v jq > /dev/null 2>&1; then
    echo "jq est requis pour la synthese (apt install jq)." >&2
    exit 1
fi

if [ ! -f ../DataShare_Front/dist/index.html ]; then
    echo "Build du front absent : lancer 'make front', qui le construit." >&2
    exit 1
fi

mkdir -p "$OUT"
rm -f "$OUT"/*.json "$OUT"/*.html "$OUT"/*-run*

cleanup() {
    $DC stop front-preview > /dev/null 2>&1 || true
    $DC rm -f front-preview > /dev/null 2>&1 || true
}
trap cleanup EXIT

$DC up -d front-preview
# nginx repond des son demarrage, mais le conteneur met un instant a publier
# son port sur la boucle locale.
timeout 30 sh -c "until curl -sf $BASE_URL > /dev/null; do sleep 1; done"

for page in $PAGES; do
    name="${page%%:*}"
    path="${page#*:}"

    i=1
    while [ "$i" -le "$RUNS" ]; do
        echo "==> $name, passage $i sur $RUNS"
        # Les deux formats a chaque passage : Lighthouse ne suffixe le fichier
        # ("…report.json") que lorsqu'il en produit plusieurs, et un nom de
        # sortie qui change d'un passage a l'autre casserait la synthese.
        $DC run --rm --entrypoint npx lighthouse lighthouse "$BASE_URL$path" \
            --budget-path=./budget.json \
            --output=json --output=html \
            --output-path="$OUT/$name-run$i" \
            --chrome-flags="--no-sandbox --disable-gpu --headless=new" \
            --quiet

        # Un seul HTML par page suffit a la lecture et a la capture d'ecran,
        # les chiffres venant du JSON.
        [ "$i" -eq 1 ] || rm -f "$OUT/$name-run$i.report.html"
        i=$((i + 1))
    done
done

./bin/lighthouse-summary.sh
