import importlib.util
import json
import os
import tempfile
import unittest
from datetime import datetime, timezone

SCRIPT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'extract-episodes.py')
spec = importlib.util.spec_from_file_location('extract_episodes', SCRIPT)
extract = importlib.util.module_from_spec(spec)
spec.loader.exec_module(extract)

TODAY = datetime.now(timezone.utc).strftime('%Y-%m-%dT10:00:00Z')


def user(text, **extra):
    return {'type': 'user', 'timestamp': TODAY, 'message': {'role': 'user', 'content': text}, **extra}


def assistant(text, tools=()):
    content = [{'type': 'text', 'text': text}] + [{'type': 'tool_use', 'name': name, 'input': input_} for name, input_ in tools]
    return {'type': 'assistant', 'timestamp': TODAY, 'message': {'role': 'assistant', 'content': content}}


def tool_result():
    return {'type': 'user', 'timestamp': TODAY, 'message': {'role': 'user', 'content': [{'type': 'tool_result', 'tool_use_id': 'x', 'content': 'ok'}]}}


class ExtractEpisodesTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.mkdtemp()
        self.project = os.path.join(self.directory, '-home-someone-projects-api')
        os.makedirs(self.project)

    def write_transcript(self, name, rows):
        path = os.path.join(self.project, f'{name}.jsonl')
        with open(path, 'w') as handle:
            for row in rows:
                handle.write(json.dumps(row) + '\n')
        return path

    def run_extract(self, *extra):
        output = os.path.join(self.directory, 'episodes.jsonl')
        extract.main(['--projects-dir', self.directory, '--output', output, '--skip-active-minutes', '0', *extra])
        with open(output) as handle:
            return [json.loads(line) for line in handle if line.strip()]

    def test_correction_after_assistant_turn_becomes_episode_with_context(self):
        self.write_transcript('s1', [
            user('implementa a fila'),
            assistant('Pronto, implementado e testado.', tools=[('Edit', {'file_path': '/r/src/queue.ts'}), ('Bash', {'command': 'npx jest'})]),
            tool_result(),
            user('não funcionou, você nem rodou o tsc'),
        ])
        episodes = self.run_extract()
        self.assertEqual(len(episodes), 1)
        episode = episodes[0]
        self.assertIn('negation', episode['signals'])
        self.assertEqual(episode['assistant_before'], 'Pronto, implementado e testado.')
        self.assertEqual(episode['files_before'], ['queue.ts'])
        self.assertEqual(episode['tools_before'], {'Edit': 1, 'Bash': 1})
        self.assertIn('machine', episode)

    def test_first_prompt_of_session_and_neutral_prompts_are_not_episodes(self):
        self.write_transcript('s2', [
            user('não sei por onde começar, me ajuda'),
            assistant('Vamos lá.'),
            user('agora cria o endpoint de listagem'),
        ])
        self.assertEqual(self.run_extract(), [])

    def test_injected_messages_and_meta_rows_are_ignored(self):
        self.write_transcript('s3', [
            user('implementa'),
            assistant('feito'),
            user('<task-notification><status>completed</status> errado</task-notification>'),
            user('isso está errado', isMeta=True),
        ])
        self.assertEqual(self.run_extract(), [])

    def test_secrets_are_redacted_in_both_sides(self):
        self.write_transcript('s4', [
            user('consulta'),
            assistant('rodei psql postgresql://v-oidc-x:Zk8-Pq2LmN0aBcDeFg@host/db'),
            user('não era isso, use PGPASSWORD=Sup3rS3cret! e o token ghp_abcdefghijklmnopqrstuvwxyz0123456789'),
        ])
        episode = self.run_extract()[0]
        serialized = json.dumps(episode)
        for secret in ('Zk8-Pq2LmN0aBcDeFg', 'Sup3rS3cret!', 'ghp_abcdefghijklmnopqrstuvwxyz0123456789'):
            self.assertNotIn(secret, serialized)
        self.assertIn('[REDACTED]', episode['user'])
        self.assertIn('[REDACTED]', episode['assistant_before'])

    def test_exclude_and_skip_session(self):
        self.write_transcript('keep', [user('a'), assistant('b'), user('errado de novo')])
        self.write_transcript('current-session', [user('a'), assistant('b'), user('errado de novo')])
        self.assertEqual(len(self.run_extract('--skip-session', 'current-session')), 1)
        self.assertEqual(self.run_extract('--exclude', 'api'), [])

    def test_old_prompts_outside_window_are_skipped(self):
        old = {'type': 'user', 'timestamp': '2020-01-01T00:00:00Z', 'message': {'role': 'user', 'content': 'errado'}}
        self.write_transcript('s5', [user('a'), assistant('b'), old])
        self.assertEqual(self.run_extract('--days', '15'), [])

    def test_secret_cut_by_truncation_is_still_fully_redacted(self):
        secret = 'Zk8Pq2LmN0aBcDeFgHi'
        prompt = 'x' * 690 + f' errado postgresql://u:{secret}@prod/db'
        answer = f'rodei postgresql://u:{secret}@prod/db ' + 'y' * 790
        self.write_transcript('cut', [user('consulta'), assistant(answer), user(prompt)])
        serialized = json.dumps(self.run_extract())
        for size in range(4, len(secret) + 1):
            for start in range(0, len(secret) - size + 1):
                self.assertNotIn(secret[start:start + size], serialized)

    def test_vault_table_and_json_passwords_are_redacted(self):
        lease = 'A1a-Kx9pQ2mZ7pLw3Rtu'
        table = f'Key                Value\nlease_id           database/creds/app/abc\npassword           {lease}\nusername           v-oidc-app'
        self.assertNotIn(lease, extract.redact(table))
        self.assertIn('username           v-oidc-app', extract.redact(table))
        self.assertNotIn(lease, extract.redact(f'{{"username": "v-oidc", "password": "{lease}"}}'))

    def test_malformed_rows_do_not_crash(self):
        path = os.path.join(self.project, 'broken.jsonl')
        with open(path, 'w') as handle:
            handle.write('null\n{"type":"user","message":null}\n{"type":"assistant","message":{"content":[null,"x"]}}\nnot json\n')
            handle.write(json.dumps(user('a')) + '\n' + json.dumps(assistant('b')) + '\n' + json.dumps(user('errado')) + '\n')
        self.assertEqual(len(self.run_extract()), 1)

    def test_bash_mode_output_is_not_a_prompt(self):
        self.write_transcript('bang', [user('a'), assistant('b'), user('<bash-stdout>ERROR: falhou tudo</bash-stdout>')])
        self.assertEqual(self.run_extract(), [])

    def test_active_sessions_are_skipped_by_default(self):
        self.write_transcript('live', [user('a'), assistant('b'), user('errado de novo')])
        output = os.path.join(self.directory, 'active.jsonl')
        extract.main(['--projects-dir', self.directory, '--output', output])
        with open(output) as handle:
            self.assertEqual(handle.read(), '')

    def test_portuguese_prepositions_at_start_are_not_negation(self):
        self.assertNotIn('negation-at-start', extract.detect_signals('no PR 4243 mudar a formula'))
        self.assertNotIn('negation-at-start', extract.detect_signals('para confirmar a entrega'))
        self.assertIn('negation-at-start', extract.detect_signals('não, isso não'))

    def test_signal_detection_covers_common_frustrations(self):
        cases = {
            'consegue ser mais curto e objetivo?': 'unclear-answer',
            'JÁ TE FALEI ISSO MIL VEZES': 'repetition',
            'faça um review minucioso': 'review-request',
            'você inventou esse endpoint': 'attention-failure',
            'tenha certeza pra não fazer merda': 'preventive-distrust',
        }
        for text, expected in cases.items():
            self.assertIn(expected, extract.detect_signals(text), text)
        self.assertEqual(extract.detect_signals('cria o módulo de relatórios'), [])


if __name__ == '__main__':
    unittest.main()
