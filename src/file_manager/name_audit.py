from __future__ import annotations

import re
from pathlib import PurePosixPath
from typing import Any


ARABIC_PATTERN = re.compile(r"[\u0600-\u06ff]")
LATIN_TOKEN_PATTERN = re.compile(r"[A-Za-z][A-Za-z']*")
REPEATED_LATIN_PATTERN = re.compile(r"([A-Za-z])\1{2,}")
REPEATED_ARABIC_PATTERN = re.compile(r"([\u0621-\u064a])\1{2,}")
REPEATED_PUNCTUATION_PATTERN = re.compile(r"([!?$#@%&*._-])\1{3,}")
MULTIPLE_SPACES_PATTERN = re.compile(r" {2,}")
MOJIBAKE_PATTERN = re.compile(r"[�ÃÂÐÑØÙ]")
TATWEEL_PATTERN = re.compile(r"\u0640{2,}")


COMMON_MISSPELLINGS = {
    "abandonned": "abandoned",
    "acheive": "achieve",
    "adress": "address",
    "advertisment": "advertisement",
    "agressive": "aggressive",
    "apparant": "apparent",
    "arguement": "argument",
    "begining": "beginning",
    "beleive": "believe",
    "calender": "calendar",
    "cemetary": "cemetery",
    "concious": "conscious",
    "definately": "definitely",
    "desparate": "desperate",
    "dissapear": "disappear",
    "embarass": "embarrass",
    "enviroment": "environment",
    "existance": "existence",
    "familar": "familiar",
    "finaly": "finally",
    "foriegn": "foreign",
    "goverment": "government",
    "happend": "happened",
    "immediatly": "immediately",
    "independant": "independent",
    "intersting": "interesting",
    "knowlege": "knowledge",
    "lenght": "length",
    "libary": "library",
    "maintainance": "maintenance",
    "mischevious": "mischievous",
    "neccessary": "necessary",
    "occured": "occurred",
    "occurence": "occurrence",
    "posession": "possession",
    "prefered": "preferred",
    "recieve": "receive",
    "recieved": "received",
    "recomend": "recommend",
    "refered": "referred",
    "remeber": "remember",
    "seperate": "separate",
    "seperated": "separated",
    "speciall": "special",
    "succesful": "successful",
    "suprise": "surprise",
    "teh": "the",
    "thier": "their",
    "tommorow": "tomorrow",
    "truely": "truly",
    "untill": "until",
    "wierd": "weird",
}


def audit_file_index_names(
    files: list[dict[str, Any]],
    scope: str = "all",
    limit: int | None = None,
) -> dict[str, Any]:
    if scope not in {"all", "files", "packages"}:
        raise ValueError("scope must be one of: all, files, packages")

    issues = []

    if scope in {"all", "files"}:
        issues.extend(_audit_files(files))

    if scope in {"all", "packages"}:
        issues.extend(_audit_packages(files))

    issues = sorted(
        issues,
        key=lambda issue: (
            issue["type"],
            issue.get("folder", "").casefold(),
            issue["name"].casefold(),
        ),
    )

    limited_issues = issues[:limit] if limit is not None else issues

    return {
        "scope": scope,
        "count": len(limited_issues),
        "total_count": len(issues),
        "arabic_dictionary_check": "skipped",
        "arabic_note": "Arabic text is scanned for spacing, repeated letters, tatweel, punctuation, and encoding damage, but normal Arabic words are not dictionary-checked.",
        "issues": limited_issues,
    }


def _audit_files(files: list[dict[str, Any]]) -> list[dict[str, Any]]:
    issues = []

    for file_entry in files:
        name = str(file_entry.get("name") or _path_name(str(file_entry.get("path", ""))))
        name_issues = _audit_name(name)

        if not name_issues:
            continue

        issues.append({
            "type": "file",
            "folder": file_entry.get("folder", ""),
            "name": name,
            "path": file_entry.get("path", ""),
            "issues": name_issues,
        })

    return issues


def _audit_packages(files: list[dict[str, Any]]) -> list[dict[str, Any]]:
    package_names: dict[tuple[str, str], str] = {}

    for file_entry in files:
        folder = str(file_entry.get("folder", ""))
        if folder:
            package_names[(folder, folder)] = folder

        path = PurePosixPath(str(file_entry.get("path", "")))
        parts = path.parts[:-1]

        current_parts = []
        for part in parts:
            current_parts.append(part)
            package_path = "/".join(current_parts)
            package_names[(folder, package_path)] = part

    issues = []

    for (folder, package_path), name in package_names.items():
        name_issues = _audit_name(name)

        if not name_issues:
            continue

        issues.append({
            "type": "package",
            "folder": folder,
            "name": name,
            "path": package_path,
            "issues": name_issues,
        })

    return issues


def _audit_name(name: str) -> list[dict[str, str]]:
    stem = PurePosixPath(name).stem
    issues = []

    issues.extend(_audit_formatting(stem))
    issues.extend(_audit_latin_spelling(stem))

    return issues


def _audit_formatting(name: str) -> list[dict[str, str]]:
    issues = []

    if MOJIBAKE_PATTERN.search(name):
        issues.append({
            "kind": "encoding",
            "message": "Name contains characters commonly seen in broken text encoding.",
        })

    if MULTIPLE_SPACES_PATTERN.search(name):
        issues.append({
            "kind": "spacing",
            "message": "Name contains repeated spaces.",
        })

    if REPEATED_PUNCTUATION_PATTERN.search(name):
        issues.append({
            "kind": "punctuation",
            "message": "Name contains repeated punctuation.",
        })

    for match in REPEATED_LATIN_PATTERN.finditer(name):
        issues.append({
            "kind": "repeated_letters",
            "token": match.group(0),
            "message": "English token contains the same letter repeated 3 or more times.",
        })

    for match in REPEATED_ARABIC_PATTERN.finditer(name):
        issues.append({
            "kind": "arabic_repeated_letters",
            "token": match.group(0),
            "message": "Arabic token contains the same letter repeated 3 or more times.",
        })

    if TATWEEL_PATTERN.search(name):
        issues.append({
            "kind": "arabic_tatweel",
            "message": "Arabic name contains repeated tatweel/kashida characters.",
        })

    return issues


def _audit_latin_spelling(name: str) -> list[dict[str, str]]:
    issues = []

    for token in LATIN_TOKEN_PATTERN.findall(name):
        normalized = token.casefold().strip("'")

        if len(normalized) <= 2:
            continue

        suggestion = COMMON_MISSPELLINGS.get(normalized)
        if suggestion is None:
            continue

        issues.append({
            "kind": "english_spelling",
            "token": token,
            "suggestion": suggestion,
            "message": f"Possible English spelling mistake: '{token}' -> '{suggestion}'.",
        })

    return issues


def _path_name(path: str) -> str:
    return path.replace("\\", "/").rsplit("/", 1)[-1]
