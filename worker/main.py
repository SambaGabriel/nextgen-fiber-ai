#!/usr/bin/env python3
"""
Worker Service Main Entry Point
Runs the queue consumer for map processing
"""

import signal
import sys
import logging
from typing import Dict, Any, Callable

from config import get_worker_settings
from consumer import create_consumer
from handlers import handle_map_processing, handle_map_reprocess

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("worker")


def create_job_handlers() -> Dict[str, Callable[[Dict[str, Any]], None]]:
    """Create map of job types to handlers."""
    return {
        "map_processing": handle_map_processing,
        "map_reprocess": handle_map_reprocess,
    }


def main():
    """Main entry point."""
    settings = get_worker_settings()

    # Set log level from settings
    logging.getLogger().setLevel(getattr(logging, settings.log_level.upper()))

    logger.info(f"Starting worker: {settings.worker_name}")
    logger.info(f"Environment: {settings.environment}")
    logger.info(f"Max concurrent jobs: {settings.max_concurrent_jobs}")

    # Create handlers
    handlers = create_job_handlers()
    logger.info(f"Registered handlers: {list(handlers.keys())}")

    # Create consumer
    consumer = create_consumer(settings, handlers)

    # Handle shutdown signals
    def signal_handler(signum, frame):
        logger.info(f"Received signal {signum}, initiating shutdown...")
        consumer.stop(wait=True, timeout=30.0)
        sys.exit(0)

    signal.signal(signal.SIGTERM, signal_handler)
    signal.signal(signal.SIGINT, signal_handler)

    # Define queues to consume
    queues = ["map_processing", "map_reprocess"]

    try:
        # Start consuming
        logger.info(f"Starting to consume from queues: {queues}")
        consumer.start(queues)
    except KeyboardInterrupt:
        logger.info("Keyboard interrupt received")
        consumer.stop()
    except Exception as e:
        logger.error(f"Worker failed: {e}")
        consumer.stop()
        sys.exit(1)


if __name__ == "__main__":
    main()
