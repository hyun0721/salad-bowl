#!/usr/bin/env python3
"""Build immutable release metadata using Git and the Python standard library."""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile


def git(repo, *args):
    return subprocess.check_output(["git", "-C", str(repo), *args], text=True, stderr=subprocess.PIPE, timeout=120,
                                   env=dict(os.environ, GIT_TERMINAL_PROMPT="0")).strip()


def default_mode():
    if os.environ.get("CF_PAGES"):
        return "production" if os.environ.get("CF_PAGES_BRANCH") == "main" else "preview"
    if os.environ.get("RENDER") or os.environ.get("RENDER_GIT_COMMIT"):
        return "production" if os.environ.get("RENDER_GIT_BRANCH") == "main" else "preview"
    return "dev"


def metadata(root, config, mode, commit, offline):
    checkout = (root / ".git").exists()
    head = git(root, "rev-parse", "HEAD") if checkout else "unknown"
    if mode == "dev":
        return {"version": "dev", "commit": head}
    commit = commit or head
    if not re.fullmatch(r"[0-9a-f]{40}", commit):
        raise ValueError("release commit must be a full SHA")
    if checkout and head != commit:
        raise ValueError("release SHA does not match source checkout")
    with tempfile.TemporaryDirectory(prefix="salad-release-") as tmp:
        repo = root if checkout else Path(tmp)
        if not checkout:
            git(repo, "init", "--bare")
        base = config["baseCommit"]
        if not re.fullmatch(r"[0-9a-f]{40}", base):
            raise ValueError("baseCommit must be a full SHA")
        try:
            history = git(repo, "rev-list", "--first-parent", commit).splitlines()
            shallow = git(repo, "rev-parse", "--is-shallow-repository") == "true"
        except subprocess.CalledProcessError:
            history, shallow = [], False
        main = None
        for ref in ("refs/remotes/release/main", "refs/remotes/origin/main", "refs/heads/main"):
            try:
                main = git(repo, "rev-parse", "--verify", ref)
                break
            except subprocess.CalledProcessError:
                pass
        if shallow or base not in history or (mode == "preview" and main is None):
            if offline:
                raise ValueError("required release history is unavailable offline")
            args = ["fetch", "--no-tags"]
            if shallow:
                args.append("--unshallow")
            git(repo, *args, config["repository"], "+refs/heads/main:refs/remotes/release/main")
            try:
                git(repo, "cat-file", "-e", commit + "^{commit}")
            except subprocess.CalledProcessError:
                git(repo, "fetch", "--no-tags", config["repository"], commit)
            history = git(repo, "rev-list", "--first-parent", commit).splitlines()
            main = git(repo, "rev-parse", "refs/remotes/release/main")
        target = git(repo, "merge-base", commit, main) if mode == "preview" else commit
        history = git(repo, "rev-list", "--first-parent", target).splitlines()
        if base not in history:
            raise ValueError("base commit is not in the release first-parent history")
        count = 0
        for sha in reversed(history[:history.index(base)]):
            if git(repo, "diff-tree", "--no-commit-id", "--name-only", "-r", sha + "^", sha, "--", *config["paths"]):
                count += 1
        version = config["prefix"] + "." + str(count)
        if mode == "preview":
            version += "-preview." + commit[:7]
        elif count == 0:
            raise ValueError("no release changes exist after the base commit")
        return {"version": version, "commit": commit}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument("--mode", choices=("dev", "preview", "production"), default=default_mode())
    parser.add_argument("--commit", default=os.environ.get("CF_PAGES_COMMIT_SHA") or os.environ.get("RENDER_GIT_COMMIT"))
    parser.add_argument("--offline", action="store_true")
    parser.add_argument("--format", choices=("json", "properties"), default="json")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    try:
        if args.mode != "dev" and (os.environ.get("CF_PAGES") or os.environ.get("RENDER")) and not args.commit:
            raise ValueError("platform release SHA is missing")
        config = json.loads((args.root / "release-version.json").read_text())
        result = metadata(args.root, config, args.mode, args.commit, args.offline)
        content = (json.dumps(result) + "\n") if args.format == "json" else "".join(k + "=" + v + "\n" for k, v in result.items())
        if args.output:
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_text(content)
        else:
            print(content, end="")
    except (ValueError, KeyError, OSError, subprocess.CalledProcessError, subprocess.TimeoutExpired) as exc:
        print("release metadata failed: " + str(exc), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
