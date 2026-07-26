#!/usr/bin/env bash
# Download the two upstream sources into ../tmp/.
# Both are free and need no API key. Run once a year, after the June Scorecard release.
set -euo pipefail

TMP="$(cd "$(dirname "$0")" && pwd)/../tmp"
mkdir -p "$TMP"

# 1. College Scorecard bulk institution file.
# The filename carries a release date, so scrape the current one off the data page
# rather than hardcoding it and silently 404ing next year.
echo "resolving current College Scorecard release..."
URL=$(curl -sL --max-time 60 "https://collegescorecard.ed.gov/data/" \
  | grep -oE 'href="[^"]*Most-Recent-Cohorts-Institution_[0-9]+\.zip"' \
  | head -1 | sed 's/^href="//; s/"$//')

if [ -z "${URL:-}" ]; then
  echo "could not find the Scorecard download link." >&2
  echo "check https://collegescorecard.ed.gov/data/ manually." >&2
  exit 1
fi

echo "downloading $URL"
curl -L --max-time 900 -o "$TMP/scorecard.zip" "$URL"
unzip -o -q "$TMP/scorecard.zip" -d "$TMP"
echo "  -> $TMP/Most-Recent-Cohorts-Institution.csv"

# 2. Wikidata: IPEDS unit ID (P1771) joined to image (P18), logo (P154), website (P856).
# This is how we get campus photographs keyed to the same identifier Scorecard uses.
echo "querying Wikidata..."
cat > "$TMP/images.sparql" <<'SPARQL'
SELECT ?ipeds ?itemLabel ?image ?logo ?website WHERE {
  ?item wdt:P1771 ?ipeds .
  OPTIONAL { ?item wdt:P18 ?image }
  OPTIONAL { ?item wdt:P154 ?logo }
  OPTIONAL { ?item wdt:P856 ?website }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
SPARQL

curl -s --max-time 300 -G "https://query.wikidata.org/sparql" \
  --data-urlencode "query@$TMP/images.sparql" \
  -H "Accept: text/csv" \
  -H "User-Agent: YakalCollegeCatalog/0.1 (https://yakal.me)" \
  -o "$TMP/wikidata_images.csv"

echo "  -> $TMP/wikidata_images.csv ($(wc -l < "$TMP/wikidata_images.csv") rows)"
echo
echo "done. next:"
echo "  python3 build_catalog.py --scorecard $TMP/Most-Recent-Cohorts-Institution.csv \\"
echo "                           --wikidata $TMP/wikidata_images.csv --out ../out"
