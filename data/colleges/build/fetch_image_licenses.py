#!/usr/bin/env python3
"""
Fetch license and attribution metadata for every Commons image in the catalog.

This is not optional. Most Wikimedia Commons photos are CC BY or CC BY-SA, which
require visible credit to the photographer wherever the image is displayed.
Shipping these images without attribution is a licence violation.

Output: ../out/image_licenses.ndjson, one record per image file, joined to the
catalog on `unitid`. Merge it into colleges.ndjson with merge_licenses.py, or
load it as its own table.

Usage:
  python3 fetch_image_licenses.py --catalog ../out/colleges.ndjson \
      --out ../out/image_licenses.ndjson
"""

import argparse
import json
import sys
import time
import urllib.parse
import urllib.request

API = "https://commons.wikimedia.org/w/api.php"
UA = "YakalCollegeCatalog/0.1 (https://yakal.me; binyam2537@gmail.com)"
BATCH = 50

# Licences that permit commercial use with attribution. Anything outside this set
# is flagged for manual review rather than silently shipped.
OK_PREFIXES = ("CC BY", "CC0", "Public domain", "Attribution")


def filename_from_url(url):
    if not url or "FilePath/" not in url:
        return None
    return urllib.parse.unquote(url.split("FilePath/")[-1])


def api_get(titles):
    params = {
        "action": "query",
        "prop": "imageinfo",
        "iiprop": "extmetadata|url|size",
        "iiurlwidth": "1600",
        "format": "json",
        "titles": "|".join("File:" + t for t in titles),
    }
    req = urllib.request.Request(
        API + "?" + urllib.parse.urlencode(params), headers={"User-Agent": UA}
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def strip_html(s):
    """extmetadata values arrive as HTML fragments."""
    if not s:
        return None
    out, depth = [], 0
    for ch in s:
        if ch == "<":
            depth += 1
        elif ch == ">":
            depth -= 1
        elif depth == 0:
            out.append(ch)
    return " ".join("".join(out).split()) or None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--catalog", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--sleep", type=float, default=0.5)
    args = ap.parse_args()

    rows = [json.loads(line) for line in open(args.catalog)]
    wanted = {}
    for r in rows:
        fn = filename_from_url(r.get("image_url"))
        if fn:
            wanted.setdefault(fn, []).append(r["unitid"])

    names = sorted(wanted)
    print(f"{len(names)} distinct image files to resolve", file=sys.stderr)

    results, flagged = [], 0
    for i in range(0, len(names), BATCH):
        chunk = names[i : i + BATCH]
        try:
            data = api_get(chunk)
        except Exception as e:  # network hiccup, keep going
            print(f"  batch {i} failed: {e}", file=sys.stderr)
            continue

        # The API normalises titles, so map back by the returned title.
        for page in data.get("query", {}).get("pages", {}).values():
            title = page.get("title", "")
            fn = title[5:] if title.startswith("File:") else title
            ii = page.get("imageinfo")
            if not ii:
                continue
            info = ii[0]
            m = info.get("extmetadata", {})

            def get(k):
                return strip_html((m.get(k) or {}).get("value"))

            lic = get("LicenseShortName")
            usable = bool(lic) and lic.startswith(OK_PREFIXES)
            if not usable:
                flagged += 1

            rec = {
                "file": fn,
                "unitids": wanted.get(fn, []),
                "license": lic,
                "license_url": get("LicenseUrl"),
                "artist": get("Artist"),
                "credit": get("Credit"),
                "attribution_required": bool(lic and lic.startswith("CC BY")),
                "commercial_use_ok": usable,
                "needs_review": not usable,
                "descriptionurl": info.get("descriptionurl"),
                "thumb_1600": info.get("thumburl"),
                "width": info.get("width"),
                "height": info.get("height"),
            }
            results.append(rec)

        print(
            f"  {min(i + BATCH, len(names))}/{len(names)}", end="\r", file=sys.stderr
        )
        time.sleep(args.sleep)

    with open(args.out, "w") as f:
        for r in results:
            f.write(json.dumps(r, separators=(",", ":")) + "\n")

    print(
        f"\nwrote {len(results)} image records, {flagged} flagged for review",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
