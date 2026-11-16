#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Ошибка: укажите путь к Markdown-отчёту: scripts/build-pdf.sh <отчёт.md>" >&2
  exit 2
fi

if ! command -v pandoc >/dev/null 2>&1; then
  echo "Ошибка: не найден pandoc. Установите его вне этого скрипта или оставьте только Markdown." >&2
  exit 1
fi

chrome=""
for candidate in google-chrome google-chrome-stable chromium chromium-browser; do
  if command -v "$candidate" >/dev/null 2>&1; then
    chrome="$(command -v "$candidate")"
    break
  fi
done

if [[ -z "$chrome" && -x "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ]]; then
  chrome="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
fi

if [[ -z "$chrome" ]]; then
  echo "Ошибка: не найден headless Chrome в PATH или по пути /Applications/Google Chrome.app/Contents/MacOS/Google Chrome. Оставьте только Markdown." >&2
  exit 1
fi

input="$(cd -- "$(dirname -- "$1")" && pwd)/$(basename -- "$1")"
if [[ ! -f "$input" ]]; then
  echo "Ошибка: Markdown-отчёт не найден: $1" >&2
  exit 1
fi

output="${input%.*}.pdf"
tmpdir="$(mktemp -d "${TMPDIR:-/tmp}/finance-api-audit-pdf.XXXXXX")"
trap 'rm -rf "$tmpdir"' EXIT

cat > "$tmpdir/style.css" <<'CSS'
@page { size: A4; margin: 18mm 16mm 18mm; }
* { box-sizing: border-box; }
body { color: #172033; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; font-size: 10.5pt; line-height: 1.55; }
h1, h2, h3, h4 { color: #0f172a; line-height: 1.2; page-break-after: avoid; }
h1 { border-bottom: 2px solid #4f46e5; font-size: 22pt; padding-bottom: 8pt; }
h2 { border-bottom: 1px solid #e2e8f0; font-size: 15pt; margin-top: 20pt; padding-bottom: 5pt; }
h3 { color: #334155; font-size: 12pt; margin-top: 15pt; }
table { border-collapse: collapse; font-size: 9pt; margin: 10pt 0 14pt; width: 100%; }
th { background: #eef2ff; color: #312e81; font-weight: 700; }
th, td { border: 1px solid #cbd5e1; padding: 6pt 7pt; text-align: left; vertical-align: top; }
code, pre { font-family: "SFMono-Regular", Consolas, monospace; }
code { background: #f1f5f9; border-radius: 3px; padding: 1pt 3pt; }
pre { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 5pt; padding: 8pt; white-space: pre-wrap; }
blockquote { border-left: 3px solid #818cf8; color: #475569; margin-left: 0; padding-left: 10pt; }
ul, ol { padding-left: 19pt; }
li { margin: 2pt 0; }
tr, img, pre, blockquote { page-break-inside: avoid; }
a { color: #4338ca; }
CSS

pandoc "$input" --from=gfm --to=html5 --standalone --embed-resources --css="$tmpdir/style.css" --output="$tmpdir/report.html"
"$chrome" --headless --disable-gpu --no-sandbox --allow-file-access-from-files --no-pdf-header-footer --print-to-pdf="$output" "file://$tmpdir/report.html" >/dev/null 2>&1

echo "PDF создан: $output"