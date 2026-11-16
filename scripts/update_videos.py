#!/usr/bin/env python3
"""달빛교회 유튜브 채널의 최근 영상을 읽어 data/videos.json 을 갱신한다.

GitHub Actions(.github/workflows/update-videos.yml)가 한 시간마다 실행한다.
유튜브 RSS는 최근 15개만 주므로, 이미 저장된 목록과 합쳐서 보관한다.
"""
import json
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

CHANNEL_ID = "UC1qNeyY604e5u4ODeHW1G1Q"
FEED = f"https://www.youtube.com/feeds/videos.xml?channel_id={CHANNEL_ID}"
OUT = Path(__file__).resolve().parent.parent / "data" / "videos.json"
KEEP = 60
NS = {
    "a": "http://www.w3.org/2005/Atom",
    "yt": "http://www.youtube.com/xml/schemas/2015",
    "m": "http://search.yahoo.com/mrss/",
}


def clean_title(title):
    return re.sub(r"\s*#\S+", "", title or "").strip()


def clean_desc(desc):
    """타임라인·해시태그 앞까지의 소개 글만 남긴다."""
    lines = []
    for line in (desc or "").replace("\\~", "~").splitlines():
        if re.search(r"⏱|타임라인|Timestamps|📍|📖", line) or line.lstrip().startswith("#"):
            break
        lines.append(line.rstrip())
    text = re.sub(r"\n{3,}", "\n\n", "\n".join(lines)).strip()
    return text[:600]


def fetch(xml_path=None):
    if xml_path:
        root = ET.parse(xml_path).getroot()
    else:
        req = urllib.request.Request(FEED, headers={"User-Agent": "moonlight-church-site"})
        with urllib.request.urlopen(req, timeout=30) as res:
            root = ET.fromstring(res.read())
    items = []
    for e in root.findall("a:entry", NS):
        link = e.find("a:link", NS).get("href", "")
        items.append({
            "id": e.find("yt:videoId", NS).text,
            "title": clean_title(e.find("a:title", NS).text),
            "published": e.find("a:published", NS).text,
            "short": "/shorts/" in link,
            "desc": clean_desc(e.findtext("m:group/m:description", default="", namespaces=NS)),
        })
    return items


def main():
    fresh = fetch(sys.argv[1] if len(sys.argv) > 1 else None)
    if not fresh:
        print("feed is empty; keeping the existing list")
        return
    old = {"videos": [], "shorts": []}
    if OUT.exists():
        old = json.loads(OUT.read_text(encoding="utf-8"))
    merged = {}
    for v in old.get("videos", []):
        merged[v["id"]] = dict(v, short=False)
    for v in old.get("shorts", []):
        merged[v["id"]] = dict(v, short=True)
    for v in fresh:
        merged[v["id"]] = v
    ordered = sorted(merged.values(), key=lambda v: v["published"], reverse=True)

    def strip(v):
        return {k: v[k] for k in ("id", "title", "published", "desc") if v.get(k)}

    data = {
        "videos": [strip(v) for v in ordered if not v["short"]][:KEEP],
        "shorts": [strip(v) for v in ordered if v["short"]][:KEEP],
    }
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"videos: {len(data['videos'])}, shorts: {len(data['shorts'])}")


if __name__ == "__main__":
    main()
