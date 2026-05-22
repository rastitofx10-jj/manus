import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  createApprovalRequest,
  createBrowserTask,
  createDeployment,
  createMission,
  createTerminalCommand,
  createTerminalSession,
  createWorkspace,
  createWorkspaceFile,
  decideApproval,
  deleteGithubConnection,
  deleteMission,
  deleteMemoryEntry,
  deleteWorkspaceFile,
  getGithubConnection,
  getMission,
  getMissionStats,
  getOrCreateAgents,
  getOrCreateDefaultWorkspace,
  listApprovalRequests,
  listBrowserTasks,
  listDeployments,
  listMemoryEntries,
  listMissionEvents,
  listMissions,
  listTerminalCommands,
  listTerminalSessions,
  listWorkspaceFiles,
  listWorkspaces,
  updateAgent,
  updateBrowserTask,
  updateDeployment,
  updateMission,
  updateTerminalCommand,
  updateTerminalSession,
  upsertGithubConnection,
  upsertMemoryEntry,
} from "./db";
import { generateMissionPlan, executeMission } from "./missionEngine";
import { classifyCommand } from "./riskClassifier";
import { storagePut } from "./storage";

// ─── Workspaces ───────────────────────────────────────────────────────────────
const workspacesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return listWorkspaces(ctx.user.id);
  }),
  getDefault: protectedProcedure.query(async ({ ctx }) => {
    return getOrCreateDefaultWorkspace(ctx.user.id);
  }),
  create: protectedProcedure
    .input(z.object({ name: z.string().min(1).max(255), description: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      return createWorkspace({ userId: ctx.user.id, name: input.name, description: input.description });
    }),
});

// ─── Missions ─────────────────────────────────────────────────────────────────
const missionsRouter = router({
  list: protectedProcedure
    .input(z.object({ workspaceId: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      return listMissions(ctx.user.id, input.workspaceId);
    }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const mission = await getMission(input.id);
      if (!mission || mission.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Mission not found" });
      }
      return mission;
    }),

  create: protectedProcedure
    .input(
      z.object({
        goal: z.string().min(10, "Goal must be at least 10 characters").max(2000),
        workspaceId: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const workspace = input.workspaceId
        ? { id: input.workspaceId }
        : await getOrCreateDefaultWorkspace(ctx.user.id);
      const title = input.goal.length > 80 ? input.goal.slice(0, 77) + "…" : input.goal;
      const mission = await createMission({
        userId: ctx.user.id,
        workspaceId: workspace.id,
        title,
        goal: input.goal,
        status: "draft",
      });
      // Auto-trigger plan generation immediately
      generateMissionPlan(mission.id, mission.goal, ctx.user.id).catch(console.error);
      return mission;
    }),

  generatePlan: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const mission = await getMission(input.id);
      if (!mission || mission.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      if (!["draft", "failed"].includes(mission.status)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Mission must be in draft or failed state to generate a plan" });
      }
      // Run plan generation asynchronously so SSE can stream events
      generateMissionPlan(input.id, mission.goal, ctx.user.id).catch(console.error);
      return { queued: true };
    }),

  approvePlan: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const mission = await getMission(input.id);
      if (!mission || mission.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      if (mission.status !== "awaiting_approval") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Mission is not awaiting approval" });
      }
      // Execute mission asynchronously
      executeMission(input.id, ctx.user.id).catch(console.error);
      return { started: true };
    }),

  pause: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const mission = await getMission(input.id);
      if (!mission || mission.userId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND" });
      await updateMission(input.id, { status: "paused" });
      return { success: true };
    }),

  stop: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const mission = await getMission(input.id);
      if (!mission || mission.userId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND" });
      await updateMission(input.id, { status: "failed", errorMessage: "Stopped by user" });
      return { success: true };
    }),

  retry: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const mission = await getMission(input.id);
      if (!mission || mission.userId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND" });
      await updateMission(input.id, { status: "draft", errorMessage: null, plan: null, summary: null });
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const mission = await getMission(input.id);
      if (!mission || mission.userId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND" });
      await deleteMission(input.id);
      return { success: true };
    }),

  getEvents: protectedProcedure
    .input(z.object({ missionId: z.number(), limit: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      const mission = await getMission(input.missionId);
      if (!mission || mission.userId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND" });
      return listMissionEvents(input.missionId, input.limit);
    }),

  stats: protectedProcedure.query(async ({ ctx }) => {
    return getMissionStats(ctx.user.id);
  }),
});

// ─── Agents ───────────────────────────────────────────────────────────────────
const agentsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return getOrCreateAgents(ctx.user.id);
  }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        status: z.enum(["idle", "active", "paused", "error"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await updateAgent(input.id, { status: input.status });
      return { success: true };
    }),
});

// ─── Terminal ─────────────────────────────────────────────────────────────────
const terminalRouter = router({
  listSessions: protectedProcedure
    .input(z.object({ workspaceId: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      return listTerminalSessions(ctx.user.id, input.workspaceId);
    }),

  createSession: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        workspaceId: z.number(),
        missionId: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return createTerminalSession({
        userId: ctx.user.id,
        workspaceId: input.workspaceId,
        missionId: input.missionId,
        name: input.name,
      });
    }),

  closeSession: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await updateTerminalSession(input.id, { status: "closed", closedAt: new Date() });
      return { success: true };
    }),

  listCommands: protectedProcedure
    .input(z.object({ sessionId: z.number() }))
    .query(async ({ ctx, input }) => {
      return listTerminalCommands(input.sessionId);
    }),

  classifyCommand: protectedProcedure
    .input(z.object({ command: z.string() }))
    .query(({ input }) => {
      return classifyCommand(input.command);
    }),

  runCommand: protectedProcedure
    .input(
      z.object({
        sessionId: z.number(),
        command: z.string().min(1),
        approvalId: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const risk = classifyCommand(input.command);

      // Destructive commands require an approved approval request
      if (risk.level === "destructive" && !input.approvalId) {
        // Create an approval request and return it for the user to act on
        const approval = await createApprovalRequest({
          userId: ctx.user.id,
          type: "terminal_command",
          title: `Execute: ${input.command.slice(0, 80)}`,
          description: `A destructive terminal command requires your approval before execution.\n\nCommand: \`${input.command}\`\n\nRisk: ${risk.reason}`,
          payload: { command: input.command, sessionId: input.sessionId },
          riskLevel: "high",
        });
        // Record the command as pending_approval
        const cmd = await createTerminalCommand({
          sessionId: input.sessionId,
          userId: ctx.user.id,
          command: input.command,
          riskLevel: risk.level,
          status: "pending_approval",
        });
        return { requiresApproval: true, approvalId: approval.id, commandId: cmd.id };
      }

      // Safe or moderate commands execute via child_process in workspace scope
      const cmd = await createTerminalCommand({
        sessionId: input.sessionId,
        userId: ctx.user.id,
        command: input.command,
        riskLevel: risk.level,
        status: "running",
      });

      const startMs = Date.now();
      let output = "";
      let exitCode = 0;

      try {
        const { execSync } = await import("child_process");
        const result = execSync(input.command, {
          timeout: 30_000,
          maxBuffer: 1024 * 1024, // 1MB
          cwd: "/tmp",
          env: { ...process.env, HOME: "/tmp", PATH: process.env.PATH ?? "/usr/bin:/bin" },
          encoding: "utf8",
        });
        output = String(result ?? "");
      } catch (err: unknown) {
        const e = err as { stdout?: string; stderr?: string; status?: number; message?: string };
        output = [e.stdout, e.stderr, e.message].filter(Boolean).join("\n") || "Command failed";
        exitCode = e.status ?? 1;
      }

      const durationMs = Date.now() - startMs;
      await updateTerminalCommand(cmd.id, {
        status: exitCode === 0 ? "completed" : "failed",
        output: output.slice(0, 50_000), // cap stored output at 50KB
        exitCode,
        durationMs,
        completedAt: new Date(),
      });

      return {
        requiresApproval: false,
        commandId: cmd.id,
        output: output.slice(0, 50_000),
        riskLevel: risk.level,
        exitCode,
      };
    }),
});

// ─── Files ────────────────────────────────────────────────────────────────────
const filesRouter = router({
  list: protectedProcedure
    .input(z.object({ workspaceId: z.number(), missionId: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      return listWorkspaceFiles(ctx.user.id, input.workspaceId, input.missionId);
    }),

  upload: protectedProcedure
    .input(
      z.object({
        workspaceId: z.number(),
        missionId: z.number().optional(),
        name: z.string(),
        path: z.string(),
        content: z.string(), // base64 encoded
        mimeType: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const buffer = Buffer.from(input.content, "base64");
      const key = `workspace-${input.workspaceId}/${ctx.user.id}/${Date.now()}-${input.name}`;
      const { url } = await storagePut(key, buffer, input.mimeType ?? "application/octet-stream");
      return createWorkspaceFile({
        userId: ctx.user.id,
        workspaceId: input.workspaceId,
        missionId: input.missionId,
        name: input.name,
        path: input.path,
        storageKey: key,
        storageUrl: url,
        size: buffer.length,
        mimeType: input.mimeType,
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await deleteWorkspaceFile(input.id, ctx.user.id);
      return { success: true };
    }),
});

// ─── Memory ───────────────────────────────────────────────────────────────────
const memoryRouter = router({
  list: protectedProcedure
    .input(z.object({ workspaceId: z.number().optional(), search: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      return listMemoryEntries(ctx.user.id, input.workspaceId, input.search);
    }),

  upsert: protectedProcedure
    .input(
      z.object({
        key: z.string().min(1).max(512),
        value: z.string().min(1),
        type: z.enum(["learning", "preference", "fact", "instruction", "artifact_summary"]),
        workspaceId: z.number().optional(),
        missionId: z.number().optional(),
        tags: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return upsertMemoryEntry({
        userId: ctx.user.id,
        key: input.key,
        value: input.value,
        type: input.type,
        workspaceId: input.workspaceId,
        missionId: input.missionId,
        tags: input.tags,
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await deleteMemoryEntry(input.id, ctx.user.id);
      return { success: true };
    }),
});

// ─── Approvals ────────────────────────────────────────────────────────────────
const approvalsRouter = router({
  list: protectedProcedure
    .input(z.object({ status: z.enum(["pending", "approved", "rejected", "expired"]).optional() }))
    .query(async ({ ctx, input }) => {
      return listApprovalRequests(ctx.user.id, input.status);
    }),

  pending: protectedProcedure.query(async ({ ctx }) => {
    return listApprovalRequests(ctx.user.id, "pending");
  }),

  decide: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        decision: z.enum(["approved", "rejected"]),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await decideApproval(input.id, ctx.user.id, input.decision, input.reason);
      return { success: true };
    }),

  create: protectedProcedure
    .input(
      z.object({
        type: z.enum(["terminal_command", "file_delete", "external_submission", "deployment", "github_write", "browser_action", "plan_approval"]),
        title: z.string().min(1).max(512),
        description: z.string().min(1),
        payload: z.record(z.string(), z.unknown()),
        riskLevel: z.enum(["low", "medium", "high", "critical"]).optional(),
        missionId: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return createApprovalRequest({
        userId: ctx.user.id,
        type: input.type,
        title: input.title,
        description: input.description,
        payload: input.payload,
        riskLevel: input.riskLevel ?? "medium",
        missionId: input.missionId,
      });
    }),
});

// ─── Deployments ──────────────────────────────────────────────────────────────
const deploymentsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return listDeployments(ctx.user.id);
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(512),
        provider: z.enum(["manus", "vercel", "netlify", "railway", "custom"]).optional(),
        missionId: z.number().optional(),
        branch: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Deployments require an approval gate
      const approval = await createApprovalRequest({
        userId: ctx.user.id,
        type: "deployment",
        title: `Deploy: ${input.name}`,
        description: `A deployment to ${input.provider ?? "manus"} requires your approval.`,
        payload: { name: input.name, provider: input.provider, branch: input.branch },
        riskLevel: "high",
        missionId: input.missionId,
      });
      const deployment = await createDeployment({
        userId: ctx.user.id,
        name: input.name,
        provider: input.provider ?? "manus",
        missionId: input.missionId,
        branch: input.branch,
        status: "pending",
        logs: [{ timestamp: Date.now(), level: "info", message: "Deployment queued, awaiting approval." }],
      });
      return { deployment, approvalId: approval.id };
    }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        status: z.enum(["pending", "building", "deploying", "live", "failed", "rolled_back"]),
        url: z.string().optional(),
        logMessage: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await listDeployments(ctx.user.id);
      const dep = existing.find((d) => d.id === input.id);
      if (!dep) throw new TRPCError({ code: "NOT_FOUND" });
      const logs = [...(dep.logs ?? [])];
      if (input.logMessage) {
        logs.push({ timestamp: Date.now(), level: "info", message: input.logMessage });
      }
      await updateDeployment(input.id, {
        status: input.status,
        url: input.url,
        logs,
        completedAt: ["live", "failed", "rolled_back"].includes(input.status) ? new Date() : undefined,
      });
      return { success: true };
    }),
});

// ─── GitHub ───────────────────────────────────────────────────────────────────
const githubRouter = router({
  getConnection: protectedProcedure
    .input(z.object({ workspaceId: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      return getGithubConnection(ctx.user.id, input.workspaceId);
    }),

  connect: protectedProcedure
    .input(
      z.object({
        owner: z.string().min(1),
        repo: z.string().min(1),
        repoUrl: z.string().url(),
        defaultBranch: z.string().optional(),
        accessToken: z.string().optional(),
        workspaceId: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // GitHub write operations require approval
      const approval = await createApprovalRequest({
        userId: ctx.user.id,
        type: "github_write",
        title: `Connect repository: ${input.owner}/${input.repo}`,
        description: `Connecting to GitHub repository ${input.owner}/${input.repo} will allow the agent to read and write code on your behalf.`,
        payload: { owner: input.owner, repo: input.repo, repoUrl: input.repoUrl },
        riskLevel: "medium",
      });
      const connection = await upsertGithubConnection({
        userId: ctx.user.id,
        owner: input.owner,
        repo: input.repo,
        repoUrl: input.repoUrl,
        defaultBranch: input.defaultBranch ?? "main",
        activeBranch: input.defaultBranch ?? "main",
        accessToken: input.accessToken,
        workspaceId: input.workspaceId,
        status: "connected",
      });
      return { connection, approvalId: approval.id };
    }),

  disconnect: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await deleteGithubConnection(input.id, ctx.user.id);
      return { success: true };
    }),

  updateBranch: protectedProcedure
    .input(z.object({ id: z.number(), branch: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      // Fetch the existing connection to ensure ownership before updating
      const existing = await getGithubConnection(ctx.user.id);
      if (!existing || existing.id !== input.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "GitHub connection not found" });
      }
      await upsertGithubConnection({
        ...existing,
        activeBranch: input.branch,
      });
      return { success: true };
    }),
});

// ─── Browser Tasks ────────────────────────────────────────────────────────────
const browserRouter = router({
  list: protectedProcedure
    .input(z.object({ missionId: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      return listBrowserTasks(ctx.user.id, input.missionId);
    }),

  create: protectedProcedure
    .input(
      z.object({
        url: z.string().url(),
        objective: z.string().min(1),
        missionId: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Browser actions require approval
      const approval = await createApprovalRequest({
        userId: ctx.user.id,
        type: "browser_action",
        title: `Browser task: ${input.objective.slice(0, 60)}`,
        description: `A browser automation task will navigate to ${input.url} and perform: ${input.objective}`,
        payload: { url: input.url, objective: input.objective },
        riskLevel: "medium",
        missionId: input.missionId,
      });
      const task = await createBrowserTask({
        userId: ctx.user.id,
        url: input.url,
        objective: input.objective,
        missionId: input.missionId,
        status: "pending",
        observations: [],
      });
      return { task, approvalId: approval.id };
    }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        status: z.enum(["pending", "running", "awaiting_approval", "completed", "failed", "takeover_required"]),
        observation: z.object({
          type: z.enum(["navigate", "click", "type", "screenshot", "extract", "error"]),
          description: z.string(),
          data: z.record(z.string(), z.unknown()).optional(),
        }).optional(),
        requiresTakeover: z.boolean().optional(),
        takeoverReason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const tasks = await listBrowserTasks(ctx.user.id);
      const task = tasks.find((t) => t.id === input.id);
      if (!task) throw new TRPCError({ code: "NOT_FOUND" });
      const observations = [...(task.observations ?? [])];
      if (input.observation) {
        observations.push({ timestamp: Date.now(), ...input.observation });
      }
      await updateBrowserTask(input.id, {
        status: input.status,
        observations,
        requiresTakeover: input.requiresTakeover,
        takeoverReason: input.takeoverReason,
        completedAt: ["completed", "failed"].includes(input.status) ? new Date() : undefined,
      });
      return { success: true };
    }),
});

// ─── App Router ───────────────────────────────────────────────────────────────
export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  workspaces: workspacesRouter,
  missions: missionsRouter,
  agents: agentsRouter,
  terminal: terminalRouter,
  files: filesRouter,
  memory: memoryRouter,
  approvals: approvalsRouter,
  deployments: deploymentsRouter,
  github: githubRouter,
  browser: browserRouter,
});

export type AppRouter = typeof appRouter;
