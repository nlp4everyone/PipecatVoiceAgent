"""Entrypoint for the Pipecat runner, pipecat-base image and Pipecat Cloud.

No logic here — see voice_agent/main.py.

    uv run bot.py
"""

from voice_agent.main import bot  # noqa: F401

if __name__ == "__main__":
    from pipecat.runner.run import main

    main()
