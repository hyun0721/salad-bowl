#!/usr/bin/env python3
"""PR 본문의 '## 소모값' 절을 로컬 Claude/Codex 세션 로그에서 만든다. LLM을 쓰지 않는다."""
import argparse
from collections import Counter, defaultdict
from datetime import datetime
import json
from pathlib import Path
import re
import subprocess

TAG = re.compile(r'\[task=([a-z-]+)\]')


def git(*args, cwd=None):
    return subprocess.run(['git', *args], capture_output=True, text=True, cwd=cwd).stdout.strip()


def repo_root(worktree):
    common = Path(worktree).is_dir() and git('rev-parse', '--path-format=absolute', '--git-common-dir', cwd=worktree)
    return Path(common).parent if common else Path(worktree)  # git 밖이면 worktree 자체


def parse_ts(value):
    try:
        t = datetime.fromisoformat(str(value).replace('Z', '+00:00'))
    except ValueError:
        return None
    return t if t.tzinfo else t.astimezone()  # naive 입력은 현지 시간으로 본다


def lines(path):
    with open(path, encoding='utf-8', errors='replace') as f:
        for raw in f:
            try:
                obj = json.loads(raw)
            except ValueError:
                continue
            if isinstance(obj, dict):
                yield obj


def text_of(content):
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return '\n'.join(c.get('text', '') for c in content if isinstance(c, dict))
    return ''


def first_tag(text):
    m = TAG.search(text)
    return m.group(1) if m else '미분류'


class Usage:
    def __init__(self):
        self.rows = defaultdict(lambda: [0, 0, 0])  # (tag, side, model) -> calls, work, cache read
        self.skills, self.mcp, self.agents, self.codex_tools = Counter(), Counter(), Counter(), Counter()
        self.sessions = {'Claude': set(), 'Codex': set()}

    def add(self, key, calls, work, cache):
        r = self.rows[key]
        r[0] += calls
        r[1] += work
        r[2] += cache


def read_claude(usage, root, branch, since, repo):
    best, tools = {}, {}
    for path in sorted(Path(root).expanduser().glob('**/*.jsonl')):
        tag = None
        for o in lines(path):
            if tag is None and o.get('type') == 'user':
                tag = first_tag(text_of((o.get('message') or {}).get('content')))
            msg = o.get('message')
            if o.get('type') != 'assistant' or not isinstance(msg, dict) or o.get('gitBranch') != branch:
                continue
            cwd = Path(o.get('cwd') or '/nonexistent')
            if repo != cwd and repo not in cwd.parents:
                continue
            ts = parse_ts(o.get('timestamp'))
            if since and (ts is None or ts < since):
                continue
            if not msg.get('id') or not msg.get('model') or msg['model'] == '<synthetic>':
                continue
            u = {k: v or 0 for k, v in (msg.get('usage') or {}).items()}
            prev = best.get(msg['id'])
            if prev is None or u.get('output_tokens', 0) > prev[1].get('output_tokens', 0):
                label = 'controller' if not o.get('isSidechain') else (tag or '미분류')
                best[msg['id']] = (label, u, msg['model'], path)
            for b in msg.get('content') or []:
                if isinstance(b, dict) and b.get('type') == 'tool_use':
                    tools[b.get('id') or (msg['id'], len(tools))] = b
    for label, u, model, path in best.values():
        work = sum(u.get(k, 0) or 0 for k in ('input_tokens', 'cache_creation_input_tokens', 'output_tokens'))
        usage.add((label, 'Claude', model), 1, work, u.get('cache_read_input_tokens', 0) or 0)
        usage.sessions['Claude'].add(str(path))
    for b in tools.values():
        name, inp = b.get('name', ''), b.get('input') or {}
        if name == 'Skill':
            usage.skills[inp.get('skill', '?')] += 1
        elif name.startswith('mcp__'):
            usage.mcp[name.split('__')[1]] += 1
        elif name == 'Agent':
            usage.agents[inp.get('subagent_type') or 'general-purpose'] += 1


def read_codex(usage, root, worktree, since, branch):
    wt = Path(worktree).resolve()
    for path in sorted(Path(root).expanduser().glob('**/rollout-*.jsonl')):
        tag = model = effort = total = None
        ok, tools = False, Counter()
        for o in lines(path):
            p = o.get('payload') if isinstance(o.get('payload'), dict) else {}
            kind, ptype = o.get('type'), p.get('type')
            if kind == 'session_meta':
                cwd = Path(p.get('cwd') or '/nonexistent').resolve()
                ts = parse_ts(p.get('timestamp') or o.get('timestamp'))
                gb = (p.get('git') or {}).get('branch')
                # git.branch가 없는 옛 rollout만 cwd 일치로 대신한다
                ok = (gb == branch if gb else cwd == wt) and not (since and (ts is None or ts < since))
            elif kind == 'turn_context':
                model, effort = p.get('model', model), p.get('effort', effort)
            elif kind == 'response_item' and ptype == 'message' and p.get('role') == 'user' and tag is None:
                m = TAG.search(text_of(p.get('content')))
                tag = m.group(1) if m else None
            elif ptype == 'token_count' and (p.get('info') or {}).get('total_token_usage'):
                total = p['info']['total_token_usage']
            elif ptype in ('function_call', 'custom_tool_call'):
                n = p.get('name', '?')
                tools['셸' if n.startswith(('exec', 'shell', 'local_shell')) else n] += 1
            elif ptype == 'mcp_tool_call_end':
                tools[(p.get('invocation') or {}).get('server', 'mcp')] += 1
        if not ok or total is None:
            continue
        cached = total.get('cached_input_tokens', 0) or 0
        work = (total.get('input_tokens', 0) - cached) + (total.get('cache_write_input_tokens', 0) or 0) \
            + (total.get('output_tokens', 0) or 0)
        usage.add((tag or '미분류', 'Codex', f"{model or '?'} / {effort or '?'}"), 1, work, cached)
        usage.sessions['Codex'].add(str(path))
        usage.codex_tools.update(tools)


def short(n):
    if n >= 999_500:
        return f'{n / 1_000_000:.2f}M'
    return f'{n / 1000:.0f}k' if n >= 1000 else str(n)


def render(usage, branch, now):
    if not usage.rows:
        return '## 소모값\n\n집계할 세션 로그가 없다.\n'
    items = sorted(usage.rows.items(), key=lambda kv: -kv[1][1])
    total = sum(r[1] for _, r in items) or 1
    side = Counter()
    for (_, s, _), r in items:
        side[s] += r[1]
    out = ['## 소모값', '',
           f"> 브랜치 `{branch}` · 로그 파일 {sum(map(len, usage.sessions.values()))}개"
           f"(Claude {len(usage.sessions['Claude'])}, Codex {len(usage.sessions['Codex'])})"
           f" · 집계 시각 {now:%Y-%m-%d %H:%M}", '',
           '**전체 대비 비중** (작업 토큰 기준: 신규 입력 + 캐시 쓰기 + 출력, 캐시 읽기 제외)', '',
           '| 작업 유형 (tag) | 수행 | 모델 / effort | 호출 | 작업 토큰 | 비중 | 캐시읽기 |',
           '|---|---|---|---:|---:|---:|---:|']
    for (tag, s, model), (calls, work, cache) in items:
        out.append(f'| {tag} | {s} | {model} | {calls} | {short(work)} | {round(work * 100 / total)}% | {short(cache)} |')
    out.append(f"| **합계** | | | {sum(r[0] for _, r in items)} | **{short(total)}** | 100% | {short(sum(r[2] for _, r in items))} |")
    out += ['', '**쪽별 비중:** ' + ' · '.join(f'{s} {round(side[s] * 100 / total)}%' for s in ('Claude', 'Codex')), '',
            '**도구 사용**', '', '| 구분 | 이름 | 횟수 |', '|---|---|---:|']
    for label, counter in (('Skill', usage.skills), ('MCP', usage.mcp), ('서브에이전트', usage.agents),
                           ('Codex 도구', usage.codex_tools)):
        out += [f'| {label} | {n} | {c} |' for n, c in counter.most_common()]
    out += ['', '작업 토큰은 캐시 읽기를 뺀 값이다. 비용은 단가가 없어 표시하지 않는다.']
    return '\n'.join(out) + '\n'


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--branch')
    ap.add_argument('--worktree')
    ap.add_argument('--since')
    ap.add_argument('--claude-dir', default='~/.claude/projects')
    ap.add_argument('--codex-dir', default='~/.codex/sessions')
    a = ap.parse_args(argv)
    branch = a.branch or git('rev-parse', '--abbrev-ref', 'HEAD')
    worktree = a.worktree or git('rev-parse', '--show-toplevel') or '.'
    since = parse_ts(a.since) if a.since else None
    if a.since and since is None:
        ap.error(f'--since 형식이 잘못됐다: {a.since}')
    usage = Usage()
    read_claude(usage, a.claude_dir, branch, since, repo_root(worktree))
    read_codex(usage, a.codex_dir, worktree, since, branch)
    print(render(usage, branch, datetime.now()), end='')


if __name__ == '__main__':
    main()
