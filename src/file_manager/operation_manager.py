from __future__ import annotations

from datetime import datetime
from threading import Event, Lock
from typing import Any, Callable
from uuid import uuid4


class OperationManager:
    def __init__(self) -> None:
        self._lock = Lock()
        self._current: dict[str, Any] | None = None
        self._stop_event: Event | None = None

    def start(self, operation_type: str, label: str) -> tuple[str, Event]:
        with self._lock:
            if self._current is not None:
                raise RuntimeError("Another operation is already running.")

            operation_id = str(uuid4())
            stop_event = Event()
            self._stop_event = stop_event
            self._current = {
                "id": operation_id,
                "type": operation_type,
                "label": label,
                "status": "running",
                "phase": "starting",
                "processed": 0,
                "total": 0,
                "started_at": datetime.now().astimezone().isoformat(timespec="seconds"),
                "stop_requested": False,
            }
            return operation_id, stop_event

    def update(self, **values: Any) -> None:
        with self._lock:
            if self._current is not None:
                self._current.update(values)

    def finish(self, status: str) -> None:
        with self._lock:
            if self._current is not None:
                self._current["status"] = status
                self._current["finished_at"] = datetime.now().astimezone().isoformat(timespec="seconds")
            self._stop_event = None
            self._current = None

    def request_stop(self) -> dict[str, Any] | None:
        with self._lock:
            if self._current is None or self._stop_event is None:
                return None
            self._current["stop_requested"] = True
            self._stop_event.set()
            return dict(self._current)

    def current(self) -> dict[str, Any] | None:
        with self._lock:
            return dict(self._current) if self._current is not None else None


operation_manager = OperationManager()


def operation_cancelled(stop_event: Event) -> Callable[[], bool]:
    return stop_event.is_set
