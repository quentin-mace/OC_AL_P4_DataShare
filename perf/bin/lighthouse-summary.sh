#!/usr/bin/env sh
#
# Synthese des rapports Lighthouse : scores medians par page, poids transfere
# par type de ressource, et verdict du budget de budget.json.
#
# Separe du script de mesure pour pouvoir etre rejoue sur des rapports deja
# produits, sans relancer Chrome.

set -eu

OUT="${OUT:-results/lighthouse}"

if ! ls "$OUT"/*.report.json > /dev/null 2>&1; then
    echo "Aucun rapport dans $OUT : lancer 'make front' d'abord." >&2
    exit 1
fi

echo "== Scores Lighthouse, mediane des passages =="
jq -s -r '
    map({
        # "home-run2.report.json" -> "home"
        page: (.requestedUrl | sub("^https?://[^/]+"; "") | if . == "" then "/" else . end),
        scores: (.categories | to_entries | map({key: .key, value: (.value.score * 100 | round)}) | from_entries)
      })
    | group_by(.page)
    | map({
        page: .[0].page,
        n: length,
        perf: ((map(.scores.performance) | sort) as $s | $s[(($s | length) / 2 | floor)]),
        a11y: ((map(.scores.accessibility) | sort) as $s | $s[(($s | length) / 2 | floor)]),
        bp: ((map(.scores["best-practices"]) | sort) as $s | $s[(($s | length) / 2 | floor)]),
        seo: ((map(.scores.seo) | sort) as $s | $s[(($s | length) / 2 | floor)])
      })
    | (["PAGE", "N", "PERF", "A11Y", "BONNES_PRATIQUES", "SEO"] | @tsv),
      (.[] | [.page, .n, .perf, .a11y, .bp, .seo] | @tsv)
' "$OUT"/*.report.json | column -t -s "$(printf '\t')"

echo
echo "== Poids transfere par type de ressource (Kio, premier passage) =="
jq -s -r '
    map(select(.requestedUrl | endswith("/")))
    | .[0].audits["resource-summary"].details.items
    | (["TYPE", "N", "KIO"] | @tsv),
      (.[] | [.resourceType, .requestCount, (.transferSize / 1024 * 10 | round / 10)] | @tsv)
' "$OUT"/home-run1.report.json | column -t -s "$(printf '\t')"

echo
echo "== Budget (budget.json) =="
over=$(jq -s -r '
    [ .[]
      | .requestedUrl as $url
      | (.audits["performance-budget"].details.items // [])
      | .[]
      | select(.sizeOverBudget != null and .sizeOverBudget > 0)
      | "\($url) : \(.label) depasse de \((.sizeOverBudget / 1024 * 10 | round / 10)) Kio"
    ] | unique | .[]
' "$OUT"/*.report.json)

if [ -z "$over" ]; then
    echo "Respecte sur toutes les pages mesurees."
else
    echo "$over"
    echo
    echo "Budget depasse : voir budget.json." >&2
    exit 1
fi
