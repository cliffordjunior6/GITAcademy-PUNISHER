# GITAcademy API — Makefile
# Usage: make <command>

.PHONY: help install up down fresh seed test lint deploy

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ── Setup ──────────────────────────────────────────────────────────────────

install: ## Install dependencies and set up environment
	composer install
	cp -n .env.example .env || true
	php artisan key:generate
	php artisan storage:link
	@echo "\n✅ Done. Edit .env then run: make migrate"

up: ## Start Docker containers
	docker compose up -d
	@echo "✅ API running at http://localhost:8000"

down: ## Stop Docker containers
	docker compose down

# ── Database ───────────────────────────────────────────────────────────────

migrate: ## Run database migrations
	php artisan migrate --force

seed: ## Seed the database with demo data
	php artisan db:seed

fresh: ## Fresh migration + seed (wipes all data)
	php artisan migrate:fresh --seed
	@echo "\n🌱 Database reset. Demo logins:"
	@echo "   Student:    justiceelorm@example.com / password"
	@echo "   Instructor: atosiaw@example.com / password"
	@echo "   Admin:      admin@GITAcadmy.com / admin123 (code: ADMIN2024)"

# ── Development ────────────────────────────────────────────────────────────

serve: ## Start dev server on port 8000
	php artisan serve --port=8000

queue: ## Start queue worker
	php artisan queue:work --queue=default,emails,videos --tries=3

schedule: ## Run scheduler (for testing)
	php artisan schedule:run

tinker: ## Open Laravel tinker REPL
	php artisan tinker

routes: ## List all API routes
	php artisan route:list --path=api

# ── Testing ────────────────────────────────────────────────────────────────

test: ## Run all tests
	php artisan test

test-unit: ## Run unit tests only
	php artisan test --testsuite=Unit

test-feature: ## Run feature tests only
	php artisan test --testsuite=Feature

test-coverage: ## Run tests with coverage report
	php artisan test --coverage --min=70

# ── Code Quality ───────────────────────────────────────────────────────────

lint: ## Run Laravel Pint code formatter
	./vendor/bin/pint

lint-check: ## Check code style without fixing
	./vendor/bin/pint --test

analyse: ## Run Larastan static analysis
	./vendor/bin/phpstan analyse app --level=5

# ── Production ─────────────────────────────────────────────────────────────

optimise: ## Cache config, routes, views for production
	php artisan config:cache
	php artisan route:cache
	php artisan view:cache
	php artisan event:cache
	php artisan optimize
	@echo "✅ Application optimised for production"

clear-cache: ## Clear all cached files
	php artisan optimize:clear
	php artisan cache:clear
	php artisan queue:restart

deploy: ## Full production deployment
	git pull origin main
	composer install --no-dev --optimize-autoloader
	php artisan migrate --force
	php artisan optimise
	php artisan queue:restart
	@echo "✅ Deployed successfully"

# ── Docker helpers ─────────────────────────────────────────────────────────

docker-build: ## Build Docker image
	docker compose build

docker-fresh: ## Rebuild containers from scratch
	docker compose down -v
	docker compose up -d --build
	docker compose exec app php artisan migrate:fresh --seed

logs: ## Tail application logs
	tail -f storage/logs/laravel.log

docker-logs: ## Tail Docker container logs
	docker compose logs -f app
