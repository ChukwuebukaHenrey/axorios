#!/usr/bin/env bash
# Cut, crop and retime the source recordings into public/clips.
# Usage: scripts/cut-clips.sh <AxoriOS.mp4> <tg.mp4>
# AxoriOS.mp4: 852x480 seller walk-through. tg.mp4: 1920x1080 Telegram -> PayPal -> paid.
set -euo pipefail
AX="$1"; TG="$2"; OUT="$(dirname "$0")/../public/clips"; mkdir -p "$OUT"
ENC=(-an -r 30 -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p -movflags +faststart)

# AxoriOS app area without browser chrome; blur the account email at the foot of the sidebar; upscale 2x.
AXF="crop=822:436:30:44,split[m][b];[b]crop=130:22:0:408,boxblur=luma_radius=8:chroma_radius=4:luma_power=2[bl];[m][bl]overlay=0:408,scale=1644:872:flags=lanczos,unsharp=5:5:0.6"
AXS="crop=822:436:30:44,scale=1644:872:flags=lanczos,unsharp=5:5:0.6"   # storefront: no sidebar

ax() { # name start end speed hold [filter]
  local f="${6:-$AXF}"
  ffmpeg -v error -y -ss "$2" -to "$3" -i "$AX" -filter_complex "[0:v]${f},setpts=PTS/$4,tpad=stop_mode=clone:stop_duration=$5" "${ENC[@]}" "$OUT/$1.mp4"
}
ax c3_voice   57  78  3    0
ax c4_brand   79  85  1    10
ax c6_publish 104 108 1    3
ax c7_store   109 117 0.8  0 "$AXS"
# c5: typed rename at 1x, then the wait sped 3x, then a short hold.
ffmpeg -v error -y -ss 85 -to 104 -i "$AX" -filter_complex \
 "[0:v]${AXF},split[p][q];[p]trim=0:8,setpts=PTS-STARTPTS[a];[q]trim=8:19,setpts=(PTS-STARTPTS)/3[b];[a][b]concat=n=2:v=1,tpad=stop_mode=clone:stop_duration=2" \
 "${ENC[@]}" "$OUT/c5_rename.mp4"

tg() { # name start end speed hold crop
  ffmpeg -v error -y -ss "$2" -to "$3" -i "$TG" -vf "$6,setpts=PTS/$4,tpad=stop_mode=clone:stop_duration=$5" "${ENC[@]}" "$OUT/$1.mp4"
}
tg c8_telegram 0    13   0.57 0 "crop=850:960:600:110"    # chat column only: hides other chats, address bar, watermark
tg c9_paypal   13   17.5 1    0.5 "crop=1832:960:68:100"
tg c10_paid    18   24   0.6  4 "crop=1832:980:68:100"

for f in "$OUT"/*.mp4; do printf '%s %ss %s\n' "$(basename "$f")" "$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")" "$(ffprobe -v error -select_streams v -show_entries stream=width,height -of csv=p=0 "$f")"; done
