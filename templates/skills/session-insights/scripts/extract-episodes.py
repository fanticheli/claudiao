#!/usr/bin/env python3
import argparse
import collections
import glob
import json
import os
import re
import socket
import sys
import time
from datetime import datetime, timedelta, timezone

SIGNALS = [
    (r'^\s*(n[ãa]o|nope|no[,.!]|wrong|errado|para[,.!]|pare|stop)(\b|\s|$)', 'negation-at-start'),
    (r'n[ãa]o (era|é|foi|funcionou|quero|precisa|pedi|faz|fa[çc]a|mexe|mexa|pode|entendi)|n[ãa]o t[áa] (certo|funcionando)|\b(didn.t work|not what i asked|don.t do)\b', 'negation'),
    (r'\berrad[oa]s?\b|\bequivoc|\bincorret|\bwrong\b', 'wrong'),
    (r'de novo|novamente|outra vez|j[áa] (te )?(falei|disse|pedi)|eu (falei|disse|pedi)|te pedi|pedi pra|\b(again|i already (said|told|asked))\b', 'repetition'),
    (r'\b(revis[ae]|review|confer[ei]|valid[ae]|double.check)\b', 'review-request'),
    (r'merda|porra|caralho|pqp|cacete|pregui[çc]os|\b(wtf|shit|fuck)', 'frustration'),
    (r'por ?que (vc|voc[êe])|\bpq (vc|voc[êe])|\bcad[êe]\b|\bu[ée]\b|\buai\b|\bwhy did you\b', 'questioning'),
    (r'esqueceu|ignorou|inventou|alucin|mentiu|chutou|n[ãa]o leu|\b(forgot|ignored|made up|hallucinat)', 'attention-failure'),
    (r'desfa[zç]|revert|volta (como|o que)|tira isso|remove isso|\bundo\b', 'undo'),
    (r'quebrou|parou de funcionar|deu erro|falhou|\b(broke|broken)\b', 'broke'),
    (r'cuidado|tenha certeza|sem fazer merda|n[ãa]o fa[çc]a merda|\bbe careful\b|\bmake sure\b', 'preventive-distrust'),
    (r'mais curto|mais objetivo|n[ãa]o entendi|\btoo long\b|\bshorter\b|\bdon.t understand\b', 'unclear-answer'),
]
SECRET_RULES = [
    (re.compile(r"((?:PG)?PASSWORD=|PASSWD=|SECRET=|TOKEN=|API_KEY=)['\"]?[^\s'\"]+", re.IGNORECASE), r"\1[REDACTED]"),
    (re.compile(r"(://[^:/\s@'\"]+:)[^@\s'\"]+@"), r"\1[REDACTED]@"),
    (re.compile(r"(\"(?:password|secret|api_key|token|client_secret)\"\s*:\s*\")[^\"]+(\")", re.IGNORECASE), r"\1[REDACTED]\2"),
    (re.compile(r"^(\s*(?:password|secret_key|secret|token|client_secret)\s{2,})\S+", re.IGNORECASE | re.MULTILINE), r"\1[REDACTED]"),
    (re.compile(r"\bAKIA[0-9A-Z]{16}\b"), "[REDACTED]"),
    (re.compile(r"\bgh[pousr]_[A-Za-z0-9]{30,}\b"), "[REDACTED]"),
    (re.compile(r"\bsk-ant-[A-Za-z0-9-]{20,}"), "[REDACTED]"),
    (re.compile(r"\bxox[baprs]-[A-Za-z0-9-]{10,}"), "[REDACTED]"),
    (re.compile(r"\bhvs\.[A-Za-z0-9]{20,}"), "[REDACTED]"),
    (re.compile(r"(Bearer\s+)[A-Za-z0-9._-]{16,}"), r"\1[REDACTED]"),
    (re.compile(r"eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]+"), "[REDACTED]"),
]
INJECTED_PREFIX = re.compile(r'^\s*<(task-notification|system-reminder|local-command|command-name|command-message|bash-input|bash-stdout|bash-stderr)')


def redact(text):
    for pattern, replacement in SECRET_RULES:
        text = pattern.sub(replacement, text)
    return text


def human_prompt_text(row):
    if row.get('type') != 'user' or row.get('isSidechain') or row.get('isMeta') or row.get('isCompactSummary'):
        return None
    content = (row.get('message') or {}).get('content')
    items = [{'type': 'text', 'text': content}] if isinstance(content, str) else (content if isinstance(content, list) else [])
    items = [item for item in items if isinstance(item, dict)]
    if any(item.get('type') == 'tool_result' for item in items):
        return None
    texts = [str(item.get('text') or '') for item in items if item.get('type') == 'text']
    texts = [text for text in texts if not INJECTED_PREFIX.match(text)]
    joined = '\n'.join(texts).strip()
    return joined or None


def detect_signals(text):
    head = text[:1500]
    found = sorted({label for pattern, label in SIGNALS if re.search(pattern, head, re.IGNORECASE)})
    letters = re.sub(r'[^A-Za-zÀ-ú]', '', head)
    if len(letters) > 15 and sum(char.isupper() for char in letters) / len(letters) > 0.6:
        found.append('all-caps')
    return found


def project_label(transcript_path):
    folder = os.path.basename(os.path.dirname(transcript_path))
    home_prefix = re.sub(r'[^A-Za-z0-9]', '-', os.path.expanduser('~'))
    label = folder.replace(f'{home_prefix}-projetos-', '').replace(f'{home_prefix}-projects-', '').replace(home_prefix, '~')
    return label or '~'


def episodes_from_transcript(path, since_date, exclude):
    project = project_label(path)
    if exclude and re.search(exclude, project):
        return [], 0
    episodes = []
    analyzed = 0
    assistant_text = ''
    tools = collections.Counter()
    edited_files = []
    seen_prompt = False
    with open(path, errors='ignore') as handle:
        for line in handle:
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                continue
            if not isinstance(row, dict):
                continue
            text = human_prompt_text(row)
            if text is not None:
                date = (row.get('timestamp') or '')[:10]
                if seen_prompt and date >= since_date:
                    analyzed += 1
                    signals = detect_signals(text)
                    if signals:
                        episodes.append({
                            'date': date,
                            'project': project,
                            'signals': signals,
                            'user': redact(text)[:700],
                            'assistant_before': redact(assistant_text)[-800:],
                            'tools_before': dict(tools.most_common(6)),
                            'files_before': edited_files[-8:],
                        })
                seen_prompt = True
                assistant_text = ''
                tools = collections.Counter()
                edited_files = []
                continue
            if row.get('type') == 'assistant' and not row.get('isSidechain'):
                message_content = (row.get('message') or {}).get('content')
                for item in message_content if isinstance(message_content, list) else []:
                    if not isinstance(item, dict):
                        continue
                    if item.get('type') == 'text' and str(item.get('text') or '').strip():
                        assistant_text = str(item['text']).strip()
                    if item.get('type') == 'tool_use':
                        tools[item.get('name')] += 1
                        file_path = (item.get('input') or {}).get('file_path')
                        if file_path and item.get('name') in ('Edit', 'Write', 'MultiEdit'):
                            edited_files.append(os.path.basename(file_path))
    return episodes, analyzed


def main(argv=None):
    parser = argparse.ArgumentParser(description='Extract correction episodes from Claude Code transcripts')
    parser.add_argument('--days', type=int, default=15)
    parser.add_argument('--projects-dir', default=os.path.expanduser('~/.claude/projects'))
    parser.add_argument('--exclude', default='', help='regex of project labels to skip')
    parser.add_argument('--skip-session', default='', help='session id to skip')
    parser.add_argument('--skip-active-minutes', type=float, default=10, help='skip transcripts modified in the last N minutes (sessions still running)')
    parser.add_argument('--output', required=True)
    args = parser.parse_args(argv)

    since_date = (datetime.now(timezone.utc) - timedelta(days=args.days)).strftime('%Y-%m-%d')
    machine = socket.gethostname()
    all_episodes = []
    analyzed_total = 0
    skipped_active = 0
    for path in sorted(glob.glob(os.path.join(args.projects_dir, '*', '*.jsonl'))):
        if args.skip_session and args.skip_session in os.path.basename(path):
            continue
        if args.skip_active_minutes and time.time() - os.path.getmtime(path) < args.skip_active_minutes * 60:
            skipped_active += 1
            continue
        episodes, analyzed = episodes_from_transcript(path, since_date, args.exclude)
        analyzed_total += analyzed
        for episode in episodes:
            episode['machine'] = machine
        all_episodes.extend(episodes)

    with open(args.output, 'w', encoding='utf-8') as handle:
        for episode in all_episodes:
            handle.write(json.dumps(episode, ensure_ascii=False) + '\n')

    signal_counts = collections.Counter(signal for episode in all_episodes for signal in episode['signals'])
    project_counts = collections.Counter(episode['project'] for episode in all_episodes)
    summary = {
        'machine': machine,
        'since': since_date,
        'prompts_analyzed': analyzed_total,
        'active_sessions_skipped': skipped_active,
        'episodes': len(all_episodes),
        'output_kb': os.path.getsize(args.output) // 1024,
        'signals': dict(signal_counts.most_common()),
        'projects': dict(project_counts.most_common(10)),
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == '__main__':
    sys.exit(main())
