# Agent OS — Autonomous AI Agent Operating System

Production-grade mission-oriented AI agent platform built with React 19, tRPC 11, Drizzle ORM, and Manus LLM.

## Features
- Autonomous mission engine (plain-language goal → LLM plan → approval → execution → summary)
- Multi-agent orchestration: Planner, Researcher, Writer, Coder, Reviewer
- Realtime SSE execution timelines (no fake data, no polling)
- Real terminal execution via child_process with 3-tier risk classification
- Mandatory approval gates for destructive commands, deployments, GitHub writes
- Persistent memory system (facts, preferences, instructions, artifacts)
- Browser task records with approval checkpoints
- Deployments and GitHub integration with approval gating
- Dark-theme mobile-first dashboard with 11-section sidebar

## Stack
React 19 · Tailwind 4 · shadcn/ui · Express 4 · tRPC 11 · Drizzle ORM · MySQL · Vitest

## Quick Start
```bash
pnpm install
pnpm drizzle-kit generate && pnpm drizzle-kit migrate
pnpm dev
pnpm test   # 47 tests passing
pnpm check  # zero TypeScript errors
```

## Architecture
- 13-table database schema
- 10 tRPC routers (missions, agents, terminal, files, memory, approvals, deployments, github, browser, workspaces)
- SSE streaming endpoint at /api/sse/mission/:id
- Mission state machine: draft → planning → awaiting_approval → executing → completed/failed
