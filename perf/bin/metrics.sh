#!/usr/bin/env sh
#
# Agrege les lignes JSON du canal "metrics" ecrites par le back pendant les
# mesures, et en sort deux tableaux : un par route, un par taille de fichier.
#
# Les logs sont lus depuis le conteneur php, ou ils vivent le temps de la
# session Docker. Une campagne se termine donc par "make metrics" avant tout
# "docker compose down", qui les effacerait.
#
# Prerequis sur le poste : jq (comme "make html" demande Node a la racine).

set -eu

SINCE="${SINCE:-24h}"
COMPOSE="docker compose -f ../compose.yaml"

if ! command -v jq > /dev/null 2>&1; then
    echo "jq est requis pour agreger les logs (apt install jq)." >&2
    exit 1
fi

lines=$($COMPOSE logs --no-log-prefix --since "$SINCE" php 2>/dev/null \
    | grep '"channel":"metrics"' || true)

if [ -z "$lines" ]; then
    echo "Aucune ligne de metrique sur les $SINCE dernieres heures." >&2
    echo "Verifier que la stack tourne et que des requetes ont ete envoyees." >&2
    exit 1
fi

echo "Metriques du back, fenetre : $SINCE"
echo

echo "== Temps de reponse par route =="
echo "$lines" | jq -s -r '
    [ .[]
      | select(.message == "request")
      | .context
      # Le nom de route plutot que le chemin : sans cela, "/api/files/42" et
      # "/api/files/43" formeraient deux groupes dune ligne chacun. Le chemin
      # reste le repli pour une requete qui na atteint aucune route.
      # (sans apostrophes : le programme jq est lui-meme entre apostrophes)
      | .label = ((.route // .path) + " -> " + (.status | tostring))
    ]
    | group_by(.label)
    | map({
        route: (.[0].method + " " + .[0].label),
        n: length,
        # Les durees sont triees pour en tirer la mediane : une moyenne serait
        # tiree par le premier appel, qui recompile le cache Symfony.
        median_ms: ((map(.duration_ms // 0) | sort) as $d | $d[(($d | length) / 2 | floor)]),
        max_ms: (map(.duration_ms // 0) | max)
      })
    | sort_by(-.max_ms)
    | (["ROUTE", "N", "MEDIANE_MS", "MAX_MS"] | @tsv),
      (.[] | [.route, .n, .median_ms, .max_ms] | @tsv)
' | column -t -s "$(printf '\t')"

echo
echo "== Ecriture dans le stockage objet, par taille de fichier =="
echo "$lines" | jq -s -r '
    [.[] | select(.message == "file.stored") | .context]
    # Regroupe par palier, l'\''octet pres les tailles d'\''un meme palier k6
    # different du nom de fichier inclus dans le corps multipart.
    | group_by(.size_bytes / 1048576 | floor)
    | map({
        mib: (.[0].size_bytes / 1048576 | floor),
        n: length,
        median_ms: ((map(.storage_write_ms) | sort) as $d | $d[(($d | length) / 2 | floor)]),
        max_ms: (map(.storage_write_ms) | max),
        # Debit effectif vers le stockage, seule facon de comparer des
        # paliers de tailles differentes.
        median_mib_s: (
            ((map(.storage_write_ms) | sort) as $d | $d[(($d | length) / 2 | floor)]) as $m
            | if $m > 0 then ((.[0].size_bytes / 1048576) / ($m / 1000) * 10 | round / 10) else null end
        )
      })
    | sort_by(.mib)
    | (["TAILLE_MIB", "N", "MEDIANE_MS", "MAX_MS", "DEBIT_MIB_S"] | @tsv),
      (.[] | [.mib, .n, .median_ms, .max_ms, .median_mib_s] | @tsv)
' | column -t -s "$(printf '\t')"
