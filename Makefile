# voice-agent — build & run helpers
#
#   make build          build the image (docker compose, BuildKit cache mounts)
#   make up             start the agent server in the background
#   make dev            run the dev runner with the WebRTC test UI (port 7860)
#   make help           list every target

IMAGE   ?= voice-agent
TAG     ?= latest
PORT    ?= 8080
COMPOSE ?= docker compose
export IMAGE TAG PORT

.DEFAULT_GOAL := help
.PHONY: help build build-nocache push up down restart logs ps shell health dev dev-down \
        run-local lint typecheck clean env

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | sort | \
	  awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

env: ## Create .env from .env.example if it does not exist
	@test -f .env || { cp .env.example .env && echo "created .env — fill in your API keys"; }

# ---- image -----------------------------------------------------------------

build: ## Build the image ($(IMAGE):$(TAG))
	$(COMPOSE) build agent

build-nocache: ## Build the image without layer cache
	$(COMPOSE) build --no-cache --pull agent

push: ## Push $(IMAGE):$(TAG) to its registry
	docker push $(IMAGE):$(TAG)

# ---- agent server (pipecat-base, port $(PORT)) ------------------------------

up: env ## Build and start the agent server in the background
	$(COMPOSE) up -d --build agent

down: ## Stop and remove containers
	$(COMPOSE) --profile dev down --remove-orphans

restart: ## Restart the agent server
	$(COMPOSE) restart agent

logs: ## Follow agent logs
	$(COMPOSE) logs -f agent

ps: ## Show container status
	$(COMPOSE) --profile dev ps

shell: ## Open a shell inside the running agent container
	$(COMPOSE) exec agent sh

health: ## Hit the liveness probe
	@curl -fsS http://localhost:$(PORT)/livez && echo

# ---- dev runner (WebRTC test UI at http://localhost:7860/client) ------------

dev: env ## Run the dev runner in the foreground with live source mounts
	$(COMPOSE) --profile dev up --build dev

dev-down: ## Stop the dev runner
	$(COMPOSE) --profile dev down dev

run-local: env ## Run the dev runner on the host with uv (no Docker)
	uv run bot.py -t webrtc

# ---- quality ----------------------------------------------------------------

lint: ## Ruff check + format check
	uv run ruff check . && uv run ruff format --check .

typecheck: ## Pyright
	uv run pyright

# ---- cleanup ----------------------------------------------------------------

clean: ## Remove containers, the built image and dangling build cache
	$(COMPOSE) --profile dev down --remove-orphans --rmi local
	docker builder prune -f
