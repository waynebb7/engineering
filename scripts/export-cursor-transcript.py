#!/usr/bin/env python3
"""
Export a Cursor agent transcript JSONL to Markdown.
Format inspired by extract_chat_gpt.js (User/Assistant sections, preserved content).
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_TRANSCRIPT = (
    Path.home()
    / ".cursor/projects/d-git-engineering/agent-transcripts"
    / "96a75e78-5d00-4e9a-a52e-bfac09f2cc13"
    / "96a75e78-5d00-4e9a-a52e-bfac09f2cc13.jsonl"
)


def format_content_block(item: dict) -> str:
    ctype = item.get("type", "")
    if ctype == "text":
        return item.get("text", "")
    if ctype == "tool_use":
        name = item.get("name", "tool")
        payload = json.dumps(item.get("input", {}), indent=2, ensure_ascii=False)
        return f"**[Tool: {name}]**\n\n```json\n{payload}\n```"
    if ctype == "tool_result":
        # Include tool results if present in transcript
        content = item.get("content", item.get("text", ""))
        if isinstance(content, list):
            parts = []
            for part in content:
                if isinstance(part, dict) and part.get("type") == "text":
                    parts.append(part.get("text", ""))
                else:
                    parts.append(str(part))
            content = "\n".join(parts)
        return f"**[Tool result]**\n\n{content}"
    return json.dumps(item, indent=2, ensure_ascii=False)


def message_to_markdown(role: str, content_items: list) -> str:
    role_title = "User" if role == "user" else "Assistant"
    body_parts = [format_content_block(item) for item in content_items]
    body = "\n\n".join(p for p in body_parts if p).strip()
    return f"## {role_title}\n\n{body}\n"


def export_transcript(transcript_path: Path, output_path: Path, include_subagents: bool = True) -> None:
    lines = transcript_path.read_text(encoding="utf-8").splitlines()
    parts: list[str] = []
    parts.append("# Exported Conversation\n")
    parts.append(f"_Exported: {datetime.now(timezone.utc).isoformat()}_\n")
    parts.append(f"_Source: `{transcript_path}`_\n")
    parts.append(
        "_Note: Content below is exported verbatim from the Cursor agent transcript. "
        "Sections marked `[REDACTED]` were redacted in the source file._\n"
    )

    msg_count = 0
    for line in lines:
        line = line.strip()
        if not line:
            continue
        obj = json.loads(line)
        role = obj.get("role", "unknown")
        message = obj.get("message", {})
        content = message.get("content", [])
        if not content:
            continue
        parts.append(message_to_markdown(role, content))
        msg_count += 1

    if include_subagents:
        sub_dir = transcript_path.parent / "subagents"
        if sub_dir.is_dir():
            for sub_file in sorted(sub_dir.glob("*.jsonl")):
                parts.append(f"\n---\n\n# Subagent transcript: `{sub_file.name}`\n\n")
                for line in sub_file.read_text(encoding="utf-8").splitlines():
                    line = line.strip()
                    if not line:
                        continue
                    obj = json.loads(line)
                    role = obj.get("role", "unknown")
                    message = obj.get("message", {})
                    content = message.get("content", [])
                    if not content:
                        continue
                    parts.append(message_to_markdown(role, content))

    md_full = "\n".join(parts).replace("\r\n", "\n")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(md_full, encoding="utf-8")
    print(f"Exported {msg_count} main messages -> {output_path}")
    print(f"Size: {output_path.stat().st_size:,} bytes")


def main() -> None:
    transcript = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_TRANSCRIPT
    if len(sys.argv) > 2:
        output = Path(sys.argv[2])
    else:
        ts = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        output = ROOT / "docs" / f"chat_export_{ts}.md"

    if not transcript.exists():
        print(f"Transcript not found: {transcript}")
        sys.exit(1)

    export_transcript(transcript, output)


if __name__ == "__main__":
    main()
