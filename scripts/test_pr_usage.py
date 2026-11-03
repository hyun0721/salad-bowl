"""가짜 세션 로그로 pr_usage 집계를 검증한다: python3 -m unittest discover -s scripts."""
import contextlib
import io
import json
from pathlib import Path
import tempfile
import unittest

import pr_usage


def write(path, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text('\n'.join(r if isinstance(r, str) else json.dumps(r) for r in rows) + '\n')


def asst(mid, out, branch='feat', ts='2026-01-02T00:00:00Z', side=False, content=None, model='m1'):
    return {'type': 'assistant', 'gitBranch': branch, 'timestamp': ts, 'isSidechain': side,
            'message': {'id': mid, 'model': model, 'content': content or [],
                        'usage': {'input_tokens': 10, 'cache_creation_input_tokens': 20,
                                  'cache_read_input_tokens': 1000, 'output_tokens': out}}}


def run(claude, codex, *args):
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        pr_usage.main(['--branch', 'feat', '--worktree', '/wt', '--claude-dir', str(claude),
                       '--codex-dir', str(codex), *args])
    return buf.getvalue()


class PrUsageTest(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.claude, self.codex = self.tmp / 'c', self.tmp / 'x'

    def test_empty(self):
        self.assertIn('집계할 세션 로그가 없다.', run(self.claude, self.codex))

    def test_claude_dedup_filters_tags_and_tools(self):
        tool = [{'type': 'tool_use', 'id': 't1', 'name': 'Skill', 'input': {'skill': 'verify'}},
                {'type': 'tool_use', 'id': 't2', 'name': 'mcp__figma__x', 'input': {}},
                {'type': 'tool_use', 'id': 't3', 'name': 'Agent', 'input': {}}]
        write(self.claude / 'p' / 's.jsonl', [
            asst('a', 5, content=tool[:1]), asst('a', 50, content=tool), 'broken{',
            asst('b', 100, branch='other'), asst('c', 100, ts='2025-12-01T00:00:00Z'),
            asst('d', 1, model='<synthetic>')])
        write(self.claude / 'p' / 's' / 'subagents' / 'agent-1.jsonl', [
            {'type': 'user', 'message': {'content': '[task=impl-web]\nhi'}}, asst('e', 70, side=True)])
        write(self.claude / 'p' / 's' / 'subagents' / 'agent-2.jsonl', [
            {'type': 'user', 'message': {'content': [{'type': 'text', 'text': 'no tag'}]}}, asst('f', 30, side=True)])
        out = run(self.claude, self.codex, '--since', '2026-01-01T00:00:00Z')
        self.assertIn('| controller | Claude | m1 | 1 | 80 | 33% | 1k |', out)
        self.assertIn('| impl-web | Claude | m1 | 1 | 100 | 42% |', out)
        self.assertIn('| 미분류 | Claude | m1 | 1 | 60 | 25% |', out)
        self.assertIn('| **합계** | | | 3 | **240** | 100% | 3k |', out)
        self.assertIn('세션 3개(Claude 3, Codex 0)', out)
        self.assertIn('| Skill | verify | 1 |', out)
        self.assertIn('| MCP | figma | 1 |', out)
        self.assertIn('| 서브에이전트 | general-purpose | 1 |', out)

    def test_codex_last_cumulative_and_cwd(self):
        def rollout(cwd, last):
            usage = lambda i, o: {'type': 'event_msg', 'payload': {'type': 'token_count', 'info': {
                'total_token_usage': {'input_tokens': i, 'cached_input_tokens': 600,
                                      'cache_write_input_tokens': 0, 'output_tokens': o}}}}
            return [{'type': 'session_meta', 'payload': {'cwd': cwd, 'timestamp': '2026-01-02T00:00:00Z'}},
                    {'type': 'turn_context', 'payload': {'model': 'gpt-x', 'effort': 'low'}},
                    {'type': 'response_item', 'payload': {'type': 'message', 'role': 'user',
                     'content': [{'type': 'input_text', 'text': '[task=docs]\n'}]}},
                    {'type': 'response_item', 'payload': {'type': 'function_call', 'name': 'exec_command'}},
                    usage(900, 10), usage(*last)]
        write(self.codex / 'rollout-1.jsonl', rollout('/wt/sub', (1000, 50)))
        write(self.codex / 'rollout-2.jsonl', rollout('/elsewhere', (1000, 50)))
        out = run(self.claude, self.codex)
        self.assertIn('| docs | Codex | gpt-x / low | 1 | 450 | 100% | 600 |', out)
        self.assertIn('세션 1개(Claude 0, Codex 1)', out)
        self.assertIn('| Codex 도구 | 셸 | 1 |', out)


if __name__ == '__main__':
    unittest.main()
