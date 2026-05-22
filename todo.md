# Agent OS — Project TODO

## Phase 1: Database Schema
- [x] Define missions table (id, title, goal, status state machine, plan JSON, summary, userId, workspaceId, timestamps)
- [x] Define mission_events table (id, missionId, type, payload JSON, agentRole, timestamp)
- [x] Define agents table (id, role, name, status, currentMissionId, tokensUsed, userId)
- [x] Define terminal_sessions table (id, missionId, workspaceId, userId, status, auditLog JSON)
- [x] Define terminal_commands table (id, sessionId, command, riskLevel, status, output, timestamps)
- [x] Define workspace_files table (id, missionId, workspaceId, userId, name, path, storageKey, size, mimeType)
- [x] Define memory_entries table (id, userId, workspaceId, type, key, value, missionId, timestamps)
- [x] Define approval_requests table (id, missionId, userId, type, payload JSON, status, decidedAt)
- [x] Define deployments table (id, missionId, userId, name, status, provider, url, logs JSON, timestamps)
- [x] Define github_connections table (id, userId, repoUrl, owner, repo, branch, accessToken, status)
- [x] Define browser_tasks table (id, missionId, userId, url, objective, status, observations JSON, screenshots JSON)
- [x] Define workspaces table (id, userId, name, description, timestamps)

## Phase 2: DB Helpers
- [x] missions CRUD helpers
- [x] mission_events insert + list helpers
- [x] agents CRUD helpers
- [x] terminal sessions + commands helpers
- [x] workspace_files helpers
- [x] memory_entries helpers
- [x] approval_requests helpers
- [x] deployments helpers
- [x] github_connections helpers
- [x] browser_tasks helpers
- [x] workspaces helpers

## Phase 3: tRPC Routers
- [x] missions router (create, list, get, updateStatus, delete, generatePlan, approvePlan, pause, stop, retry, getEvents, stats)
- [x] agents router (list, updateStatus)
- [x] terminal router (createSession, runCommand, listCommands, closeSession, classifyCommand)
- [x] files router (list, upload, delete)
- [x] memory router (list, upsert, delete)
- [x] approvals router (list, pending, decide, create)
- [x] deployments router (list, create, updateStatus)
- [x] github router (getConnection, connect, disconnect, updateBranch)
- [x] browser router (list, create, updateStatus)
- [x] workspaces router (list, create, getDefault)

## Phase 4: SSE + Execution Engine
- [x] SSE endpoint /api/sse/mission/:id streaming mission events
- [x] Mission execution engine: plan → approve → execute → summarize state machine
- [x] LLM integration for plan generation (invokeLLM with structured output)
- [x] LLM integration for executive summary generation
- [x] Agent task dispatcher (planner, researcher, writer, coder, reviewer roles)
- [x] Terminal command risk classifier (safe / moderate / destructive)
- [x] Approval gate enforcement (block execution until approved)

## Phase 5: Dashboard Shell
- [x] Dark theme CSS variables in index.css (OKLCH color space)
- [x] AgentOS layout component with collapsible sidebar
- [x] Sidebar: Dashboard, Missions, Agents, Terminal, Files, Browser, Memory, Approvals, Deployments, GitHub, Settings
- [x] Mobile-first responsive sidebar (Sheet drawer on mobile)
- [x] Pending approvals badge on Approvals nav item
- [x] App.tsx routing for all 12 pages

## Phase 6: Missions UI
- [x] Mission list page with status badges, filter tabs
- [x] New mission modal: plain-language goal input with validation
- [x] Mission detail page: plan steps, execution timeline, agent feed
- [x] Realtime SSE event feed (thought, action, tool_call, status_change events)
- [x] Executive summary panel on completion
- [x] Mission state machine controls (approve plan, pause, stop, retry)

## Phase 7: Agents, Terminal, Files, Memory, Approvals UI
- [x] Agents page: role cards, status, token usage, current task
- [x] Terminal page: session list, command input, risk badges, approval gate for destructive commands
- [x] Files page: workspace file list, upload, delete
- [x] Memory page: entry list, type filter, search, add/edit/delete
- [x] Approvals page: pending list, approve/reject with reason, history tab
- [x] BrowserTasks page: task list, create form, observations

## Phase 8: Deployments, GitHub, Settings UI
- [x] Deployments page: deployment list, status badges, create form with approval gate
- [x] GitHub page: connect repo form, connection state, approval gate for write ops
- [x] Settings page: workspace management, user profile

## Phase 9: QA and Delivery
- [x] 47 vitest tests passing (riskClassifier, auth, missions, agents, terminal, memory, approvals, workspaces, deployments, files, browser, github)
- [x] TypeScript check passes (tsc --noEmit) — zero errors
- [x] Dark theme renders correctly with OKLCH variables
- [x] All routes registered and working
- [x] No placeholder data or fake Math.random() execution
- [x] SSE streaming connected to real LLM execution engine
- [x] Real terminal command execution via child_process (workspace-scoped, 30s timeout, 1MB output cap)
- [x] Approval enforcement for destructive terminal commands (creates approval record, blocks execution)
- [x] Deployment create returns pending status + approval record before any execution
- [x] GitHub connect creates approval record before persisting connection
- [x] Fixed updateBranch to safely update existing connection by ID with ownership check
- [ ] Save checkpoint
- [ ] Push to GitHub
