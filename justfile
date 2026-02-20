set shell := ["bash", "-euo", "pipefail", "-c"]

default: help

help:
    @just --list

# ============================================
# Setup
# ============================================

setup: setup-backend setup-frontend

setup-backend:
    cd backend && go mod download

setup-frontend:
    cd frontend && npm install

# ============================================
# Development
# ============================================

# Run Go server on :8080
dev-backend:
    cd backend && go run . serve

# Run Vite dev server with HMR on :5173
dev-frontend:
    cd frontend && npm run dev

# ============================================
# Build
# ============================================

build-backend:
    cd backend && go build -o bin/server .

build-frontend:
    cd frontend && npm run build

build: build-backend build-frontend

# ============================================
# Code Quality
# ============================================

check: lint-backend test

lint-backend:
    cd backend && go vet ./...

lint-frontend:
    cd frontend && npm run lint

test:
    cd backend && go test -v ./...

# ============================================
# Docker
# ============================================

docker-up:
    docker compose up --build -d

docker-down:
    docker compose down

docker-logs:
    docker compose logs -f
