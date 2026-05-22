import { and, desc, eq, like, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  Agent,
  AgentRole,
  ApprovalRequest,
  BrowserTask,
  Deployment,
  GithubConnection,
  InsertAgent,
  InsertApprovalRequest,
  InsertBrowserTask,
  InsertDeployment,
  InsertGithubConnection,
  InsertMemoryEntry,
  InsertMission,
  InsertMissionEvent,
  InsertTerminalCommand,
  InsertTerminalSession,
  InsertUser,
  InsertWorkspace,
  InsertWorkspaceFile,
  MemoryEntry,
  Mission,
  MissionEvent,
  TerminalCommand,
  TerminalSession,
  Workspace,
  WorkspaceFile,
  agents,
  approvalRequests,
  browserTasks,
  deployments,
  githubConnections,
  memoryEntries,
  missionEvents,
  missions,
  terminalCommands,
  terminalSessions,
  users,
  workspaceFiles,
  workspaces,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ────────────────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    const v = user[field];
    if (v !== undefined) {
      values[field] = v ?? null;
      updateSet[field] = v ?? null;
    }
  }
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  values.role = user.openId === ENV.ownerOpenId ? "admin" : (user.role ?? "user");
  updateSet.role = values.role;
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

// ─── Workspaces ───────────────────────────────────────────────────────────────
export async function getOrCreateDefaultWorkspace(userId: number): Promise<Workspace> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const existing = await db
    .select()
    .from(workspaces)
    .where(and(eq(workspaces.userId, userId), eq(workspaces.isDefault, true)))
    .limit(1);
  if (existing[0]) return existing[0];
  await db.insert(workspaces).values({ userId, name: "Default Workspace", isDefault: true });
  const created = await db
    .select()
    .from(workspaces)
    .where(and(eq(workspaces.userId, userId), eq(workspaces.isDefault, true)))
    .limit(1);
  return created[0]!;
}

export async function listWorkspaces(userId: number): Promise<Workspace[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(workspaces).where(eq(workspaces.userId, userId)).orderBy(desc(workspaces.createdAt));
}

export async function createWorkspace(data: InsertWorkspace): Promise<Workspace> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(workspaces).values(data);
  const result = await db
    .select()
    .from(workspaces)
    .where(and(eq(workspaces.userId, data.userId!), eq(workspaces.name, data.name)))
    .orderBy(desc(workspaces.createdAt))
    .limit(1);
  return result[0]!;
}

// ─── Missions ─────────────────────────────────────────────────────────────────
export async function createMission(data: InsertMission): Promise<Mission> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(missions).values(data);
  const result = await db
    .select()
    .from(missions)
    .where(and(eq(missions.userId, data.userId), eq(missions.title, data.title)))
    .orderBy(desc(missions.createdAt))
    .limit(1);
  return result[0]!;
}

export async function getMission(id: number): Promise<Mission | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(missions).where(eq(missions.id, id)).limit(1);
  return result[0];
}

export async function listMissions(userId: number, workspaceId?: number): Promise<Mission[]> {
  const db = await getDb();
  if (!db) return [];
  const conditions = workspaceId
    ? and(eq(missions.userId, userId), eq(missions.workspaceId, workspaceId))
    : eq(missions.userId, userId);
  return db.select().from(missions).where(conditions).orderBy(desc(missions.createdAt));
}

export async function updateMission(id: number, data: Partial<Mission>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(missions).set(data as Record<string, unknown>).where(eq(missions.id, id));
}

export async function deleteMission(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(missions).where(eq(missions.id, id));
}

// ─── Mission Events ────────────────────────────────────────────────────────────
export async function insertMissionEvent(data: InsertMissionEvent): Promise<MissionEvent> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(missionEvents).values(data);
  const result = await db
    .select()
    .from(missionEvents)
    .where(eq(missionEvents.missionId, data.missionId))
    .orderBy(desc(missionEvents.createdAt))
    .limit(1);
  return result[0]!;
}

export async function listMissionEvents(missionId: number, limit = 200): Promise<MissionEvent[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(missionEvents)
    .where(eq(missionEvents.missionId, missionId))
    .orderBy(missionEvents.createdAt)
    .limit(limit);
}

// ─── Agents ───────────────────────────────────────────────────────────────────
export async function getOrCreateAgents(userId: number): Promise<Agent[]> {
  const db = await getDb();
  if (!db) return [];
  const existing = await db.select().from(agents).where(eq(agents.userId, userId));
  if (existing.length === 5) return existing;
  const roles: { role: AgentRole; name: string }[] = [
    { role: "planner", name: "Planner" },
    { role: "researcher", name: "Researcher" },
    { role: "writer", name: "Writer" },
    { role: "coder", name: "Coder" },
    { role: "reviewer", name: "Reviewer" },
  ];
  const existingRoles = new Set(existing.map((a) => a.role));
  for (const { role, name } of roles) {
    if (!existingRoles.has(role)) {
      await db.insert(agents).values({ userId, role, name });
    }
  }
  return db.select().from(agents).where(eq(agents.userId, userId));
}

export async function updateAgent(id: number, data: Partial<Agent>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(agents).set(data as Record<string, unknown>).where(eq(agents.id, id));
}

export async function getAgentByRole(userId: number, role: AgentRole): Promise<Agent | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(agents)
    .where(and(eq(agents.userId, userId), eq(agents.role, role)))
    .limit(1);
  return result[0];
}

// ─── Terminal Sessions ────────────────────────────────────────────────────────
export async function createTerminalSession(data: InsertTerminalSession): Promise<TerminalSession> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(terminalSessions).values(data);
  const result = await db
    .select()
    .from(terminalSessions)
    .where(eq(terminalSessions.userId, data.userId))
    .orderBy(desc(terminalSessions.createdAt))
    .limit(1);
  return result[0]!;
}

export async function listTerminalSessions(userId: number, workspaceId?: number): Promise<TerminalSession[]> {
  const db = await getDb();
  if (!db) return [];
  const cond = workspaceId
    ? and(eq(terminalSessions.userId, userId), eq(terminalSessions.workspaceId, workspaceId))
    : eq(terminalSessions.userId, userId);
  return db.select().from(terminalSessions).where(cond).orderBy(desc(terminalSessions.createdAt));
}

export async function updateTerminalSession(id: number, data: Partial<TerminalSession>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(terminalSessions).set(data as Record<string, unknown>).where(eq(terminalSessions.id, id));
}

// ─── Terminal Commands ────────────────────────────────────────────────────────
export async function createTerminalCommand(data: InsertTerminalCommand): Promise<TerminalCommand> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(terminalCommands).values(data);
  const result = await db
    .select()
    .from(terminalCommands)
    .where(eq(terminalCommands.sessionId, data.sessionId))
    .orderBy(desc(terminalCommands.createdAt))
    .limit(1);
  return result[0]!;
}

export async function listTerminalCommands(sessionId: number): Promise<TerminalCommand[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(terminalCommands)
    .where(eq(terminalCommands.sessionId, sessionId))
    .orderBy(terminalCommands.createdAt);
}

export async function updateTerminalCommand(id: number, data: Partial<TerminalCommand>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(terminalCommands).set(data as Record<string, unknown>).where(eq(terminalCommands.id, id));
}

// ─── Workspace Files ──────────────────────────────────────────────────────────
export async function listWorkspaceFiles(userId: number, workspaceId: number, missionId?: number): Promise<WorkspaceFile[]> {
  const db = await getDb();
  if (!db) return [];
  const cond = missionId
    ? and(eq(workspaceFiles.userId, userId), eq(workspaceFiles.workspaceId, workspaceId), eq(workspaceFiles.missionId, missionId))
    : and(eq(workspaceFiles.userId, userId), eq(workspaceFiles.workspaceId, workspaceId));
  return db.select().from(workspaceFiles).where(cond).orderBy(desc(workspaceFiles.createdAt));
}

export async function createWorkspaceFile(data: InsertWorkspaceFile): Promise<WorkspaceFile> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(workspaceFiles).values(data);
  const result = await db
    .select()
    .from(workspaceFiles)
    .where(and(eq(workspaceFiles.userId, data.userId), eq(workspaceFiles.storageKey, data.storageKey)))
    .limit(1);
  return result[0]!;
}

export async function deleteWorkspaceFile(id: number, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(workspaceFiles).where(and(eq(workspaceFiles.id, id), eq(workspaceFiles.userId, userId)));
}

// ─── Memory Entries ───────────────────────────────────────────────────────────
export async function listMemoryEntries(userId: number, workspaceId?: number, search?: string): Promise<MemoryEntry[]> {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(memoryEntries.userId, userId)];
  if (workspaceId) conditions.push(eq(memoryEntries.workspaceId, workspaceId));
  if (search) conditions.push(or(like(memoryEntries.key, `%${search}%`), like(memoryEntries.value, `%${search}%`))!);
  return db.select().from(memoryEntries).where(and(...conditions)).orderBy(desc(memoryEntries.updatedAt));
}

export async function upsertMemoryEntry(data: InsertMemoryEntry): Promise<MemoryEntry> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const existing = await db
    .select()
    .from(memoryEntries)
    .where(and(eq(memoryEntries.userId, data.userId), eq(memoryEntries.key, data.key)))
    .limit(1);
  if (existing[0]) {
    await db.update(memoryEntries).set({ value: data.value, tags: data.tags }).where(eq(memoryEntries.id, existing[0].id));
    return { ...existing[0], value: data.value, tags: data.tags ?? null };
  }
  await db.insert(memoryEntries).values(data);
  const result = await db
    .select()
    .from(memoryEntries)
    .where(and(eq(memoryEntries.userId, data.userId), eq(memoryEntries.key, data.key)))
    .limit(1);
  return result[0]!;
}

export async function deleteMemoryEntry(id: number, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(memoryEntries).where(and(eq(memoryEntries.id, id), eq(memoryEntries.userId, userId)));
}

// ─── Approval Requests ────────────────────────────────────────────────────────
export async function createApprovalRequest(data: InsertApprovalRequest): Promise<ApprovalRequest> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(approvalRequests).values(data);
  const result = await db
    .select()
    .from(approvalRequests)
    .where(eq(approvalRequests.userId, data.userId))
    .orderBy(desc(approvalRequests.createdAt))
    .limit(1);
  return result[0]!;
}

export async function listApprovalRequests(userId: number, status?: ApprovalRequest["status"]): Promise<ApprovalRequest[]> {
  const db = await getDb();
  if (!db) return [];
  const cond = status
    ? and(eq(approvalRequests.userId, userId), eq(approvalRequests.status, status))
    : eq(approvalRequests.userId, userId);
  return db.select().from(approvalRequests).where(cond).orderBy(desc(approvalRequests.createdAt));
}

export async function decideApproval(id: number, userId: number, status: "approved" | "rejected", reason?: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(approvalRequests)
    .set({ status, decidedBy: userId, decisionReason: reason ?? null, decidedAt: new Date() })
    .where(eq(approvalRequests.id, id));
}

// ─── Deployments ──────────────────────────────────────────────────────────────
export async function createDeployment(data: InsertDeployment): Promise<Deployment> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(deployments).values(data);
  const result = await db
    .select()
    .from(deployments)
    .where(eq(deployments.userId, data.userId))
    .orderBy(desc(deployments.createdAt))
    .limit(1);
  return result[0]!;
}

export async function listDeployments(userId: number): Promise<Deployment[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(deployments).where(eq(deployments.userId, userId)).orderBy(desc(deployments.createdAt));
}

export async function updateDeployment(id: number, data: Partial<Deployment>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(deployments).set(data as Record<string, unknown>).where(eq(deployments.id, id));
}

// ─── GitHub Connections ───────────────────────────────────────────────────────
export async function getGithubConnection(userId: number, workspaceId?: number): Promise<GithubConnection | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const cond = workspaceId
    ? and(eq(githubConnections.userId, userId), eq(githubConnections.workspaceId, workspaceId))
    : eq(githubConnections.userId, userId);
  const result = await db.select().from(githubConnections).where(cond).orderBy(desc(githubConnections.createdAt)).limit(1);
  return result[0];
}

export async function upsertGithubConnection(data: InsertGithubConnection): Promise<GithubConnection> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const existing = await getGithubConnection(data.userId, data.workspaceId ?? undefined);
  if (existing) {
    await db.update(githubConnections).set(data as Record<string, unknown>).where(eq(githubConnections.id, existing.id));
    return { ...existing, ...data } as GithubConnection;
  }
  await db.insert(githubConnections).values(data);
  const result = await db
    .select()
    .from(githubConnections)
    .where(eq(githubConnections.userId, data.userId))
    .orderBy(desc(githubConnections.createdAt))
    .limit(1);
  return result[0]!;
}

export async function deleteGithubConnection(id: number, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(githubConnections).where(and(eq(githubConnections.id, id), eq(githubConnections.userId, userId)));
}

// ─── Browser Tasks ────────────────────────────────────────────────────────────
export async function createBrowserTask(data: InsertBrowserTask): Promise<BrowserTask> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(browserTasks).values(data);
  const result = await db
    .select()
    .from(browserTasks)
    .where(eq(browserTasks.userId, data.userId))
    .orderBy(desc(browserTasks.createdAt))
    .limit(1);
  return result[0]!;
}

export async function listBrowserTasks(userId: number, missionId?: number): Promise<BrowserTask[]> {
  const db = await getDb();
  if (!db) return [];
  const cond = missionId
    ? and(eq(browserTasks.userId, userId), eq(browserTasks.missionId, missionId))
    : eq(browserTasks.userId, userId);
  return db.select().from(browserTasks).where(cond).orderBy(desc(browserTasks.createdAt));
}

export async function updateBrowserTask(id: number, data: Partial<BrowserTask>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(browserTasks).set(data as Record<string, unknown>).where(eq(browserTasks.id, id));
}

// ─── Stats helpers ────────────────────────────────────────────────────────────
export async function getMissionStats(userId: number) {
  const db = await getDb();
  if (!db) return { total: 0, completed: 0, executing: 0, failed: 0 };
  const rows = await db
    .select({ status: missions.status, count: sql<number>`count(*)` })
    .from(missions)
    .where(eq(missions.userId, userId))
    .groupBy(missions.status);
  const stats = { total: 0, completed: 0, executing: 0, failed: 0 };
  for (const row of rows) {
    stats.total += Number(row.count);
    if (row.status === "completed") stats.completed += Number(row.count);
    if (row.status === "executing") stats.executing += Number(row.count);
    if (row.status === "failed") stats.failed += Number(row.count);
  }
  return stats;
}
