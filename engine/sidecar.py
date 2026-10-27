"""Frozen-sidecar entry point.

PyInstaller runs the entry script as `__main__`, so a relative import
(`from .app import ...`) fails there with "attempted relative import with no
known parent package". This module exists only to import absolutely, and is the
script the packaging step points at.
"""

from engine.app import main

if __name__ == "__main__":
    main()
