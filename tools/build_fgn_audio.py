import base64, html, json, re, subprocess, tempfile, zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EPUB = ROOT / 'Tales of a Fourth Grade Nothing (Judy Blume) (z-library.sk, 1lib.sk, z-lib.sk).epub'
OUT = ROOT / 'public' / 'fourth-grade-nothing' / 'audio'
OUT.mkdir(parents=True, exist_ok=True)
titles = ['The Big Winner', 'Mr. and Mrs. Juicy-O', 'The Family Dog', 'My Brother the Bird', 'The Birthday Bash', 'Fang Hits Town', 'The Flying Train Committee', 'The TV Star', 'Just Another Rainy Day', 'Dribble!']
groups = [[1], [2], [3], [4], [5], [6], [7], [8], [9], [10]]

with zipfile.ZipFile(EPUB) as z:
    raw = z.read('47.xhtml').decode('utf-8')
starts = []
for title in titles:
    m = re.search(r'<span class="ts2">' + re.escape(title) + r'</span>', raw)
    if not m: raise RuntimeError(f'missing chapter: {title}')
    starts.append(m.start())
chapters = []
for i, start in enumerate(starts):
    end = starts[i+1] if i + 1 < len(starts) else len(raw)
    text = raw[start:end]
    text = re.sub(r'<[^>]+>', ' ', text)
    text = html.unescape(text)
    text = re.sub(r'\s+', ' ', text).strip()
    text = re.sub(r'^' + re.escape(titles[i]) + r'\s*', '', text)
    text = re.sub(r'\s+\d{1,3}(?=\s|$)', ' ', text)
    chapters.append(text)

token = subprocess.check_output(['gcloud','auth','application-default','print-access-token'], text=True).strip()
api = 'https://texttospeech.googleapis.com/v1/text:synthesize'

def chunks(text, limit=1800):
    parts = []
    while len(text) > limit:
        cut = text.rfind(' ', 0, limit)
        if cut < 1000: cut = limit
        parts.append(text[:cut].strip()); text = text[cut:].strip()
    if text: parts.append(text)
    return parts

for day, nums in enumerate(groups, 1):
    target = OUT / f'day{day}.mp3'
    if target.exists() and target.stat().st_size > 10000:
        print('exists', target); continue
    with tempfile.TemporaryDirectory() as td:
        pieces = []
        text = ' '.join(chapters[n-1] for n in nums)
        for idx, part in enumerate(chunks(text)):
            payload = json.dumps({'input': {'text': part}, 'voice': {'languageCode':'en-US','name':'en-US-Journey-F'}, 'audioConfig': {'audioEncoding':'MP3','speakingRate':0.95}})
            res = subprocess.run(['curl','-x','http://127.0.0.1:7897','--http1.1','--fail','--silent','--show-error','--connect-timeout','30','--max-time','300','-X','POST',api,'-H',f'Authorization: Bearer {token}','-H','x-goog-user-project: gen-lang-client-0474546891','-H','Content-Type: application/json','-d',payload], check=True, capture_output=True, text=True)
            data = json.loads(res.stdout)
            piece = Path(td) / f'piece{idx}.mp3'
            piece.write_bytes(base64.b64decode(data['audioContent']))
            pieces.append(piece)
        concat = Path(td) / 'concat.txt'
        concat.write_text('\n'.join(f"file '{p}'" for p in pieces))
        subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-f','concat','-safe','0','-i',str(concat),'-c','copy',str(target),'-y'], check=True)
    print('built', target, target.stat().st_size)
