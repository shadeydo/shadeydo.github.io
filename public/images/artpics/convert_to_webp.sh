
OUTPUT_DIR="webp_output"
mkdir -p "$OUTPUT_DIR"


# 0-100
STILL_QUALITY=80
# Animated WebP quality
ANIM_QUALITY=82
# Method 0-6 (6 = slowest/best compression)
METHOD=4


echo "Output dir : $OUTPUT_DIR"
echo "Still quality : $STILL_QUALITY"
echo "Anim quality  : $ANIM_QUALITY"


GIF_COUNT=0
for f in *.gif; do
  [ -e "$f" ] || { echo "No GIFs found, skipping."; break; }

  OUT="$OUTPUT_DIR/${f%.gif}.webp"
  echo ""
  echo "► GIF: $f"

  ffmpeg -v warning -i "$f" \
    -c:v libwebp_anim \
    -quality "$ANIM_QUALITY" \
    -compression_level "$METHOD" \
    -loop 0 \
    -preset picture \
    -an \
    -vsync 0 \
    "$OUT"

  if [ $? -eq 0 ]; then
    ORIG=$(du -sh "$f" | cut -f1)
    NEW=$(du -sh "$OUT" | cut -f1)
    echo "  ✓ Done: $ORIG → $NEW"
    GIF_COUNT=$((GIF_COUNT + 1))
  else
    echo "  ✗ Failed: $f"
  fi
done


PNG_COUNT=0
for f in *.png; do
  [ -e "$f" ] || { echo "No PNGs found, skipping."; break; }

  OUT="$OUTPUT_DIR/${f%.png}.webp"
  echo ""
  echo "► PNG: $f"

  ffmpeg -v warning -i "$f" \
    -c:v libwebp \
    -quality "$STILL_QUALITY" \
    -compression_level "$METHOD" \
    -preset picture \
    -pix_fmt yuva420p \
    "$OUT"

  if [ $? -eq 0 ]; then
    ORIG=$(du -sh "$f" | cut -f1)
    NEW=$(du -sh "$OUT" | cut -f1)
    echo "  ✓ Done: $ORIG → $NEW"
    PNG_COUNT=$((PNG_COUNT + 1))
  else
    echo "  ✗ Failed: $f"
  fi
done

JPEG_COUNT=0
for f in *.jpg *.jpeg; do
  [ -e "$f" ] || continue

  EXT="${f##*.}"
  OUT="$OUTPUT_DIR/${f%.$EXT}.webp"
  echo ""
  echo "► JPEG: $f"

  ffmpeg -v warning -i "$f" \
    -c:v libwebp \
    -quality "$STILL_QUALITY" \
    -compression_level "$METHOD" \
    -preset photo \
    -pix_fmt yuv420p \
    "$OUT"

  if [ $? -eq 0 ]; then
    ORIG=$(du -sh "$f" | cut -f1)
    NEW=$(du -sh "$OUT" | cut -f1)
    echo "  ✓ Done: $ORIG → $NEW"
    JPEG_COUNT=$((JPEG_COUNT + 1))
  else
    echo "  ✗ Failed: $f"
  fi
done


echo " Done!"
echo "  GIFs converted  : $GIF_COUNT"
echo "  PNGs converted  : $PNG_COUNT"
echo "  JPEGs converted : $JPEG_COUNT"
echo "  Output folder   : ./$OUTPUT_DIR"

