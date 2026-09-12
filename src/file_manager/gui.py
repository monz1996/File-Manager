from __future__ import annotations

import argparse
import sys
import threading
import time
import webbrowser

import uvicorn


def open_browser(url: str, delay: float = 1.2):
    time.sleep(delay)
    webbrowser.open(url)


def main(args_list: list[str] | None = None):
    parser = argparse.ArgumentParser(description="Start the File Manager Web GUI")
    parser.add_argument("--host", default="127.0.0.1", help="Host address")
    parser.add_argument("--port", type=int, default=8000, help="Port number")
    parser.add_argument("--no-browser", action="store_true", help="Do not automatically open the browser")
    parser.add_argument("--reload", action="store_true", help="Enable auto-reload for development")

    if args_list is None:
        raw_args = list(sys.argv[1:])
        if raw_args and raw_args[0] == "gui":
            raw_args = raw_args[1:]
        args = parser.parse_args(raw_args)
    else:
        args = parser.parse_args(args_list)

    url = f"http://{args.host}:{args.port}"

    print(f"\n=======================================================")
    print(f"  File Manager GUI starting at: {url}")
    print(f"=======================================================\n")

    if not args.no_browser:
        threading.Thread(target=open_browser, args=(url,), daemon=True).start()

    uvicorn.run("file_manager.api:app", host=args.host, port=args.port, reload=args.reload)


if __name__ == "__main__":
    main()
