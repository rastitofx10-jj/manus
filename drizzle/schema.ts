import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  bigint,
  json,
  boolean,
} from "drizzle-orm/mysql-core";

// ─── Users ────────────────────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Workspaces ───────────────────────────────────────────────────────────────
export const workspaces = mysqlTable("workspaces", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  isDefault: boolean("isDefault").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Workspace = typeof workspaces.$inferSelect;
export type InsertWorkspace = typeof workspaces.$inferInsert;

// ─── Missions ─────────────────────────────────────────────────────────────────
export const missions = mysqlTable("missions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  workspaceId: int("workspaceId").notNull(),
  title: varchar("title", { length: 512 }).notNull(),
  goal: text("goal").notNull(),
  status: mysqlEnum("status", [
    "draft",
    "planning",
    "awaiting_approval",
    "executing",
    "paused",
    "completed",
    "failed",
  ])
    .default("draft")
    .notNull(),
  plan: json("plan").$type<MissionPlanStep[]>(),
  summary: text("summary"),
  errorMessage: text("errorMessage"),
  agentRoles: json("agentRoles").$type<string[]>(),
  tokensUsed: int("tokensUsed").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  completedAt: timestamp("completedAt"),
});

export type Mission = typeof missions.$inferSelect;
export type InsertMission = typeof missions.$inferInsert;
export type MissionStatus = Mission["status"];

export interface MissionPlanStep {
  id: string;
  order: number;
  title: string;
  description: string;
  agentRole: AgentRole;
  estimatedDuration: string;
  status: "pending" | "in_progress" | "completed" | "failed" | "skipped";
  tools: string[];
  output?: string;
}

// ─── Mission Events ────────────────────────────────────────────────────────────
export const missionEvents = mysqlTable("mission_events", {
  id: int("id").autoincrement().primaryKey(),
  missionId: int("missionId").notNull(),
  agentRole: varchar("agentRole", { length: 64 }),
  type: mysqlEnum("type", [
    "thought",
    "action",
    "tool_call",
    "terminal",
    "file_write",
    "browser",
    "approval_request",
    "approval_decision",
    "status_change",
    "error",
    "summary",
  ]).notNull(),
  payload: json("payload").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type MissionEvent = typeof missionEvents.$inferSelect;
export type InsertMissionEvent = typeof missionEvents.$inferInsert;
export type MissionEventType = MissionEvent["type"];

// ─── Agents ───────────────────────────────────────────────────────────────────
export type AgentRole = "planner" | "researcher" | "writer" | "coder" | "reviewer";

export const agents = mysqlTable("agents", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  role: mysqlEnum("role", ["planner", "researcher", "writer", "coder", "reviewer"]).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  status: mysqlEnum("status", ["idle", "active", "paused", "error"]).default("idle").notNull(),
  currentMissionId: int("currentMissionId"),
  currentTask: text("currentTask"),
  tokensUsed: bigint("tokensUsed", { mode: "number" }).default(0).notNull(),
  tasksCompleted: int("tasksCompleted").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Agent = typeof agents.$inferSelect;
export type InsertAgent = typeof agents.$inferInsert;

// ─── Terminal Sessions ────────────────────────────────────────────────────────
export const terminalSessions = mysqlTable("terminal_sessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  workspaceId: int("workspaceId").notNull(),
  missionId: int("missionId"),
  name: varchar("name", { length: 255 }).notNull(),
  status: mysqlEnum("status", ["open", "closed", "error"]).default("open").notNull(),
  workingDirectory: varchar("workingDirectory", { length: 1024 }).default("/workspace").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  closedAt: timestamp("closedAt"),
});

export type TerminalSession = typeof terminalSessions.$inferSelect;
export type InsertTerminalSession = typeof terminalSessions.$inferInsert;

// ─── Terminal Commands ────────────────────────────────────────────────────────
export const terminalCommands = mysqlTable("terminal_commands", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  userId: int("userId").notNull(),
  command: text("command").notNull(),
  riskLevel: mysqlEnum("riskLevel", ["safe", "moderate", "destructive"]).default("safe").notNull(),
  status: mysqlEnum("status", ["pending_approval", "approved", "rejected", "running", "completed", "failed"]).default("running").notNull(),
  output: text("output"),
  exitCode: int("exitCode"),
  durationMs: int("durationMs"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
});

export type TerminalCommand = typeof terminalCommands.$inferSelect;
export type InsertTerminalCommand = typeof terminalCommands.$inferInsert;

// ─── Workspace Files ──────────────────────────────────────────────────────────
export const workspaceFiles = mysqlTable("workspace_files", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  workspaceId: int("workspaceId").notNull(),
  missionId: int("missionId"),
  name: varchar("name", { length: 512 }).notNull(),
  path: varchar("path", { length: 2048 }).notNull(),
  storageKey: varchar("storageKey", { length: 1024 }).notNull(),
  storageUrl: varchar("storageUrl", { length: 2048 }).notNull(),
  size: bigint("size", { mode: "number" }).default(0).notNull(),
  mimeType: varchar("mimeType", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type WorkspaceFile = typeof workspaceFiles.$inferSelect;
export type InsertWorkspaceFile = typeof workspaceFiles.$inferInsert;

// ─── Memory Entries ───────────────────────────────────────────────────────────
export const memoryEntries = mysqlTable("memory_entries", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  workspaceId: int("workspaceId"),
  missionId: int("missionId"),
  type: mysqlEnum("type", [
    "learning",
    "preference",
    "fact",
    "instruction",
    "artifact_summary",
  ]).notNull(),
  key: varchar("key", { length: 512 }).notNull(),
  value: text("value").notNull(),
  tags: json("tags").$type<string[]>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MemoryEntry = typeof memoryEntries.$inferSelect;
export type InsertMemoryEntry = typeof memoryEntries.$inferInsert;

// ─── Approval Requests ────────────────────────────────────────────────────────
export const approvalRequests = mysqlTable("approval_requests", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  missionId: int("missionId"),
  type: mysqlEnum("type", [
    "terminal_command",
    "file_delete",
    "external_submission",
    "deployment",
    "github_write",
    "browser_action",
    "plan_approval",
  ]).notNull(),
  title: varchar("title", { length: 512 }).notNull(),
  description: text("description").notNull(),
  payload: json("payload").$type<Record<string, unknown>>().notNull(),
  riskLevel: mysqlEnum("riskLevel", ["low", "medium", "high", "critical"]).default("medium").notNull(),
  status: mysqlEnum("status", ["pending", "approved", "rejected", "expired"]).default("pending").notNull(),
  decidedBy: int("decidedBy"),
  decisionReason: text("decisionReason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  decidedAt: timestamp("decidedAt"),
  expiresAt: timestamp("expiresAt"),
});

export type ApprovalRequest = typeof approvalRequests.$inferSelect;
export type InsertApprovalRequest = typeof approvalRequests.$inferInsert;

// ─── Deployments ──────────────────────────────────────────────────────────────
export const deployments = mysqlTable("deployments", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  missionId: int("missionId"),
  name: varchar("name", { length: 512 }).notNull(),
  provider: mysqlEnum("provider", ["manus", "vercel", "netlify", "railway", "custom"]).default("manus").notNull(),
  status: mysqlEnum("status", ["pending", "building", "deploying", "live", "failed", "rolled_back"]).default("pending").notNull(),
  url: varchar("url", { length: 2048 }),
  branch: varchar("branch", { length: 255 }),
  commitSha: varchar("commitSha", { length: 64 }),
  logs: json("logs").$type<DeploymentLogEntry[]>(),
  environmentVars: json("environmentVars").$type<Record<string, string>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  completedAt: timestamp("completedAt"),
});

export type Deployment = typeof deployments.$inferSelect;
export type InsertDeployment = typeof deployments.$inferInsert;

export interface DeploymentLogEntry {
  timestamp: number;
  level: "info" | "warn" | "error";
  message: string;
}

// ─── GitHub Connections ───────────────────────────────────────────────────────
export const githubConnections = mysqlTable("github_connections", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  workspaceId: int("workspaceId"),
  owner: varchar("owner", { length: 255 }).notNull(),
  repo: varchar("repo", { length: 255 }).notNull(),
  repoUrl: varchar("repoUrl", { length: 2048 }).notNull(),
  defaultBranch: varchar("defaultBranch", { length: 255 }).default("main").notNull(),
  activeBranch: varchar("activeBranch", { length: 255 }).default("main").notNull(),
  accessToken: varchar("accessToken", { length: 1024 }),
  status: mysqlEnum("status", ["connected", "disconnected", "error"]).default("connected").notNull(),
  lastSyncedAt: timestamp("lastSyncedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type GithubConnection = typeof githubConnections.$inferSelect;
export type InsertGithubConnection = typeof githubConnections.$inferInsert;

// ─── Browser Tasks ────────────────────────────────────────────────────────────
export const browserTasks = mysqlTable("browser_tasks", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  missionId: int("missionId"),
  url: varchar("url", { length: 2048 }).notNull(),
  objective: text("objective").notNull(),
  status: mysqlEnum("status", [
    "pending",
    "running",
    "awaiting_approval",
    "completed",
    "failed",
    "takeover_required",
  ]).default("pending").notNull(),
  observations: json("observations").$type<BrowserObservation[]>(),
  currentScreenshotUrl: varchar("currentScreenshotUrl", { length: 2048 }),
  requiresTakeover: boolean("requiresTakeover").default(false).notNull(),
  takeoverReason: text("takeoverReason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  completedAt: timestamp("completedAt"),
});

export type BrowserTask = typeof browserTasks.$inferSelect;
export type InsertBrowserTask = typeof browserTasks.$inferInsert;

export interface BrowserObservation {
  timestamp: number;
  type: "navigate" | "click" | "type" | "screenshot" | "extract" | "error";
  description: string;
  data?: Record<string, unknown>;
}
