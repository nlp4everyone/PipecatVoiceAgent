FROM dailyco/pipecat-base:0.1.29

# Uncomment if you wish to print a summary of the features available in the base image
# ENV PCC_LOG_FEATURES_SUMMARY=true

# 1. Dependencies only — this layer is cached until the lockfile changes
RUN --mount=type=cache,target=/root/.cache/uv \
    --mount=type=bind,source=uv.lock,target=uv.lock \
    --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
    uv sync --locked --no-install-project --no-dev

# 2. Application code, then install the voice_agent package itself
COPY ./pyproject.toml ./uv.lock ./bot.py ./
COPY ./voice_agent ./voice_agent
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked --no-dev
