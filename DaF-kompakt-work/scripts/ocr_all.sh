#!/bin/zsh
# OCR every page image into ocr/p-NNN.txt (German). Skips pages already done.
cd "$(dirname "$0")/.."
export OMP_THREAD_LIMIT=1
ls pages/p-*.png | xargs -P 6 -I{} zsh -c '
  f="{}"; b=$(basename "$f" .png)
  [ -s "ocr/$b.txt" ] || tesseract "$f" "ocr/$b" -l deu --psm 4 >/dev/null 2>&1
'
echo "done: $(ls ocr/*.txt | wc -l) pages"
