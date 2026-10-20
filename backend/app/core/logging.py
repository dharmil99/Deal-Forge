"""
backend/app/core/logging.py

Minimal, structured logging configuration for DealForge.
Provides clear, readable log records without excessive noise or sensitive leaks.
"""

import logging
import sys


def configure_logging(level: int = logging.INFO) -> None:
    """Configure root logging for the DealForge application."""
    root_logger = logging.getLogger()

    # Prevent duplicate handlers on reloads
    if root_logger.handlers:
        return

    formatter = logging.Formatter(
        fmt="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)
    handler.setLevel(level)

    root_logger.setLevel(level)
    root_logger.addHandler(handler)

    # Silence overly verbose third-party loggers if needed
    logging.getLogger("uvicorn.access").setLevel(logging.INFO)
