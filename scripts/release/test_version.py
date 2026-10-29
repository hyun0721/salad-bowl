import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

SCRIPT = Path(__file__).with_name("version.py").resolve()


class VersionTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.repo = Path(self.tmp.name)
        self.git("init", "-b", "main")
        self.git("config", "user.email", "version@example.test")
        self.git("config", "user.name", "Version Test")
        self.change("README.md", "base")
        self.base = self.git("rev-parse", "HEAD")
        (self.repo / "release-version.json").write_text(json.dumps({
            "baseCommit": self.base, "prefix": "0.1", "repository": str(self.repo),
            "paths": ["apps/web/", "apps/api/", "release-version.json", "scripts/release/"],
        }))
        self.git("add", ".")
        self.git("commit", "-m", "release configuration")

    def git(self, *args):
        return subprocess.check_output(["git", "-C", str(self.repo), *args], text=True, stderr=subprocess.DEVNULL).strip()

    def change(self, path, text):
        p = self.repo / path
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(text)
        self.git("add", ".")
        self.git("commit", "-m", text)
        return self.git("rev-parse", "HEAD")

    def run_version(self, *args, success=True):
        env = {k: v for k, v in os.environ.items() if not k.startswith(("CF_", "RENDER", "RELEASE_"))}
        result = subprocess.run([sys.executable, str(SCRIPT), "--root", str(self.repo), *args],
                                capture_output=True, text=True, env=env)
        if success:
            self.assertEqual(result.returncode, 0, result.stderr)
            return json.loads(result.stdout)
        self.assertNotEqual(result.returncode, 0)
        return result.stderr

    def test_related_changes_and_docs(self):
        a = self.run_version("--mode", "production")
        self.assertEqual(a["version"], "0.1.1")
        self.change("docs/guide.md", "docs only")
        self.assertEqual(self.run_version("--mode", "production")["version"], "0.1.1")
        sha = self.change("apps/web/a.ts", "web change")
        self.assertEqual(self.run_version("--mode", "production"), {"version": "0.1.2", "commit": sha})
        self.change("apps/api/a.java", "api change")
        self.assertEqual(self.run_version("--mode", "production")["version"], "0.1.3")

    def test_merge_counts_once_and_retries_and_rollback_are_stable(self):
        previous = self.git("rev-parse", "HEAD")
        self.git("checkout", "-b", "feature")
        self.change("apps/web/a.ts", "first")
        self.change("apps/web/a.ts", "second")
        self.git("checkout", "main")
        self.git("merge", "--no-ff", "feature", "-m", "feature merge")
        self.assertEqual(self.run_version("--mode", "production")["version"], "0.1.2")
        self.assertEqual(self.run_version("--mode", "production"), self.run_version("--mode", "production"))
        self.git("checkout", "--detach", previous)
        self.assertEqual(self.run_version("--mode", "production")["version"], "0.1.1")

    def test_preview_does_not_claim_a_production_version(self):
        self.git("checkout", "-b", "feature")
        sha = self.change("apps/web/a.ts", "preview")
        self.assertEqual(self.run_version("--mode", "preview")["version"], "0.1.1-preview." + sha[:7])

    def test_squash_counts_once(self):
        self.git("checkout", "-b", "feature")
        self.change("apps/web/a.ts", "one")
        self.change("apps/web/a.ts", "two")
        self.git("checkout", "main")
        self.git("merge", "--squash", "feature")
        self.git("commit", "-m", "squash")
        self.assertEqual(self.run_version("--mode", "production")["version"], "0.1.2")

    def test_missing_base_and_sha_mismatch_fail(self):
        self.assertIn("checkout", self.run_version("--mode", "production", "--commit", self.base, success=False))
        config = self.repo / "release-version.json"
        data = json.loads(config.read_text())
        data["baseCommit"] = "a" * 40
        config.write_text(json.dumps(data))
        self.assertIn("history", self.run_version("--mode", "production", "--offline", success=False))

    def test_development_does_not_need_history(self):
        self.assertEqual(self.run_version("--mode", "dev")["version"], "dev")

    def test_shallow_checkout_is_completed_from_origin(self):
        sha = self.change("apps/web/a.ts", "shallow")
        clone = self.repo / "clone"
        subprocess.run(["git", "clone", "--depth=1", self.repo.as_uri(), str(clone)], check=True, capture_output=True)
        original = self.repo
        self.repo = clone
        self.assertEqual(self.run_version("--mode", "production"), {"version": "0.1.2", "commit": sha})
        self.repo = original

    def test_shallow_preview_gets_both_main_and_feature_history(self):
        self.git("checkout", "-b", "feature")
        sha = self.change("apps/web/a.ts", "preview shallow")
        clone = self.repo / "preview-clone"
        subprocess.run(["git", "clone", "--branch", "feature", "--depth=1", self.repo.as_uri(), str(clone)], check=True, capture_output=True)
        original = self.repo
        self.repo = clone
        self.assertEqual(self.run_version("--mode", "preview"), {"version": "0.1.1-preview." + sha[:7], "commit": sha})
        self.repo = original

    def test_missing_platform_sha_fails_instead_of_shipping_dev(self):
        env = dict(os.environ, RENDER="true", RENDER_GIT_BRANCH="main")
        env.pop("RENDER_GIT_COMMIT", None)
        result = subprocess.run([sys.executable, str(SCRIPT), "--root", str(self.repo)],
                                capture_output=True, text=True, env=env)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("platform", result.stderr)

    def test_properties_output_and_no_checkout_build_context(self):
        sha = self.change("apps/api/a.java", "docker source")
        context = self.repo / "context"
        context.mkdir()
        (context / "release-version.json").write_text((self.repo / "release-version.json").read_text())
        result = subprocess.run([sys.executable, str(SCRIPT), "--root", str(context), "--mode", "production",
                                 "--commit", sha, "--format", "properties"], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout, "version=0.1.2\ncommit=" + sha + "\n")


if __name__ == "__main__":
    unittest.main()
