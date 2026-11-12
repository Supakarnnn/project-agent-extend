import re


def text_content(content: str | list) -> str:
    """Read text blocks only, never structured reasoning blocks."""
    if isinstance(content, list):
        content = "".join(
            block if isinstance(block, str) else block.get("text", "")
            for block in content
            if isinstance(block, str)
            or isinstance(block, dict) and block.get("type") == "text"
        )
    return content


def public_answer(content: str | list, *, partial: bool = False) -> str:
    """Buffer unmarked streaming output until it can be safely cleaned in full."""
    content = text_content(content)
    content = re.sub(r"<think\s*>.*?</think\s*>", "", content, flags=re.I | re.S)
    # Some providers omit the opening tag; everything before the close is reasoning.
    content = re.split(r"</think\s*>", content, flags=re.I)[-1]
    # A truncated reasoning block must never be displayed.
    content = re.split(r"<think\s*>", content, flags=re.I)[0]
    marker = re.search(r"<answer\s*>", content, flags=re.I)
    if marker:
        content = re.split(r"</answer\s*>", content[marker.end():], flags=re.I)[0]
    elif partial:
        return ""
    if partial:
        # Hold incomplete markup when a tag is split across network chunks.
        content = re.sub(r"<[^>]*$", "", content)
    return content.strip()
