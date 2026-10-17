# voice-agent — build & run helpers
#
#   make build          build the image (docker compose, BuildKit cache mounts)
#   make up             start the agent server in the background
#   make dev            run the dev runner with the WebRTC test UI (port 7860)
#   make dev-all        run the agent and the web app on the host (7860 + 5173)
#   make help           list every target

IMAGE   ?= voice-agent
TAG     ?= latest
PORT    ?= 8080
COMPOSE ?= docker compose
export IMAGE TAG PORT

.DEFAULT_GOAL := help
.PHONY: help build build-nocache push up down restart logs ps shell health dev dev-down \
        run-local web-install web-dev dev-all lint typecheck clean env

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

# ---- web app (apps/web, Pipecat UI, http://localhost:5173) ----------------

web-install: ## Install the web app dependencies (Node 22+)
	cd apps/web && npm install

web-dev: ## Run the web app; needs the dev runner (make dev / run-local) on 7860
	cd apps/web && npm run dev

# Each pipeline runs in its own process group (set -m) so the EXIT trap can kill
# uv/python and npm/vite as a whole. Ctrl+C, or either side exiting, stops both.
dev-all: SHELL := bash
dev-all: env ## Run the agent (uv, 7860) and the web app (5173) together on the host
	@test -d apps/web/node_modules || { cd apps/web && npm install; }
	@set -m -o pipefail; \
	trap 'exit 130' INT TERM; \
	trap 'kill -- $$(jobs -p | sed "s/^/-/") 2>/dev/null' EXIT; \
	PYTHONUNBUFFERED=1 uv run bot.py -t webrtc 2>&1 | sed -u 's/^/\x1b[1;33m[BE]\x1b[0m /' & \
	(cd apps/web && npm run dev) 2>&1 | sed -u 's/^/\x1b[1;36m[FE]\x1b[0m /' & \
	wait -n

# ---- quality ----------------------------------------------------------------

lint: ## Ruff check + format check
	uv run ruff check . && uv run ruff format --check .

typecheck: ## Pyright
	uv run pyright

# ---- cleanup ----------------------------------------------------------------

clean: ## Remove containers, the built image and dangling build cache
	$(COMPOSE) --profile dev down --remove-orphans --rmi local
	docker builder prune -f
