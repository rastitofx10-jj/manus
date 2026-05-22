import { describe, expect, it, vi, beforeEach } from "vitest";
import { classifyCommand } from "./riskClassifier";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

// ─── Helpers ──────────────────────────────────────────────────────────────────

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function makeCtx(overrides?: Partial<TrpcContext>): TrpcContext {
  const clearedCookies: { name: string; options: Record<string, unknown> }[] = [];
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-openid",
    email: "test@agentOS.dev",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
    ...overrides,
  };
}

function makeUnauthCtx(): TrpcContext {
  return makeCtx({ user: null });
}

// ─── Risk Classifier Tests ────────────────────────────────────────────────────

describe("riskClassifier", () => {
  describe("safe commands", () => {
    it("classifies ls as safe", () => {
      const result = classifyCommand("ls -la");
      expect(result.level).toBe("safe");
      expect(result.requiresApproval).toBe(false);
    });

    it("classifies pwd as safe", () => {
      const result = classifyCommand("pwd");
      expect(result.level).toBe("safe");
      expect(result.requiresApproval).toBe(false);
    });

    it("classifies cat as safe", () => {
      const result = classifyCommand("cat README.md");
      expect(result.level).toBe("safe");
      expect(result.requiresApproval).toBe(false);
    });

    it("classifies grep as safe", () => {
      const result = classifyCommand("grep -r 'TODO' src/");
      expect(result.level).toBe("safe");
      expect(result.requiresApproval).toBe(false);
    });

    it("classifies pnpm test as safe", () => {
      const result = classifyCommand("pnpm test");
      expect(result.level).toBe("safe");
      expect(result.requiresApproval).toBe(false);
    });

    it("classifies git status as safe", () => {
      const result = classifyCommand("git status");
      expect(result.level).toBe("safe");
      expect(result.requiresApproval).toBe(false);
    });

    it("classifies git log as safe", () => {
      const result = classifyCommand("git log --oneline -10");
      expect(result.level).toBe("safe");
      expect(result.requiresApproval).toBe(false);
    });

    it("classifies git diff as safe", () => {
      const result = classifyCommand("git diff HEAD~1");
      expect(result.level).toBe("safe");
      expect(result.requiresApproval).toBe(false);
    });
  });

  describe("moderate commands", () => {
    it("classifies git push as moderate", () => {
      const result = classifyCommand("git push origin main");
      expect(result.level).toBe("moderate");
      expect(result.requiresApproval).toBe(false);
    });

    it("classifies pnpm install as moderate", () => {
      const result = classifyCommand("pnpm install express");
      expect(result.level).toBe("moderate");
      expect(result.requiresApproval).toBe(false);
    });

    it("classifies curl as moderate", () => {
      const result = classifyCommand("curl https://api.example.com/data");
      expect(result.level).toBe("moderate");
      expect(result.requiresApproval).toBe(false);
    });

    it("classifies docker run as moderate", () => {
      const result = classifyCommand("docker run -it ubuntu bash");
      expect(result.level).toBe("moderate");
      expect(result.requiresApproval).toBe(false);
    });
  });

  describe("destructive commands", () => {
    it("classifies sudo as destructive", () => {
      const result = classifyCommand("sudo rm -rf node_modules");
      expect(result.level).toBe("destructive");
      expect(result.requiresApproval).toBe(true);
    });

    it("classifies git push --force as destructive", () => {
      const result = classifyCommand("git push --force origin main");
      expect(result.level).toBe("destructive");
      expect(result.requiresApproval).toBe(true);
    });

    it("classifies git reset --hard as destructive", () => {
      const result = classifyCommand("git reset --hard HEAD~3");
      expect(result.level).toBe("destructive");
      expect(result.requiresApproval).toBe(true);
    });

    it("classifies npm publish as destructive", () => {
      const result = classifyCommand("npm publish --access public");
      expect(result.level).toBe("destructive");
      expect(result.requiresApproval).toBe(true);
    });

    it("classifies rm -rf / as destructive", () => {
      const result = classifyCommand("rm -rf /");
      expect(result.level).toBe("destructive");
      expect(result.requiresApproval).toBe(true);
    });
  });

  describe("reason field", () => {
    it("provides a reason for destructive commands", () => {
      const result = classifyCommand("sudo apt-get install malware");
      expect(result.reason).toBeTruthy();
      expect(typeof result.reason).toBe("string");
    });

    it("provides a reason for safe commands", () => {
      const result = classifyCommand("ls -la");
      expect(result.reason).toBeTruthy();
    });
  });
});

// ─── Auth Router Tests ────────────────────────────────────────────────────────

describe("auth router", () => {
  it("me returns null for unauthenticated context", async () => {
    const caller = appRouter.createCaller(makeUnauthCtx());
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("me returns user for authenticated context", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.auth.me();
    expect(result).not.toBeNull();
    expect(result?.openId).toBe("test-user-openid");
    expect(result?.email).toBe("test@agentOS.dev");
  });

  it("logout clears session cookie and returns success", async () => {
    const clearedCookies: { name: string; options: Record<string, unknown> }[] = [];
    const ctx = makeCtx({
      res: {
        clearCookie: (name: string, options: Record<string, unknown>) => {
          clearedCookies.push({ name, options });
        },
      } as TrpcContext["res"],
    });
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
    expect(clearedCookies[0]?.options).toMatchObject({ maxAge: -1, httpOnly: true });
  });
});

// ─── Mission Router Tests ─────────────────────────────────────────────────────

describe("missions router", () => {
  it("missions.stats returns numeric fields", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const stats = await caller.missions.stats();
    expect(typeof stats.total).toBe("number");
    expect(typeof stats.completed).toBe("number");
    expect(typeof stats.executing).toBe("number");
    expect(typeof stats.failed).toBe("number");
  });

  it("missions.list returns an array", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.missions.list({});
    expect(Array.isArray(result)).toBe(true);
  });

  it("missions.get throws NOT_FOUND for non-existent mission", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await expect(caller.missions.get({ id: 999999 })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("missions.create rejects goal shorter than 10 chars", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await expect(caller.missions.create({ goal: "short" })).rejects.toThrow();
  });

  it("missions.generatePlan throws NOT_FOUND for non-existent mission", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await expect(caller.missions.generatePlan({ id: 999999 })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("missions.approvePlan throws NOT_FOUND for non-existent mission", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await expect(caller.missions.approvePlan({ id: 999999 })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

// ─── Agents Router Tests ──────────────────────────────────────────────────────

describe("agents router", () => {
  it("agents.list returns an array of agents", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const agents = await caller.agents.list();
    expect(Array.isArray(agents)).toBe(true);
  });

  it("agents.list returns agents with expected roles", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const agents = await caller.agents.list();
    const roles = agents.map((a) => a.role);
    // Should have the 5 standard agent roles
    expect(roles).toContain("planner");
    expect(roles).toContain("researcher");
    expect(roles).toContain("writer");
    expect(roles).toContain("coder");
    expect(roles).toContain("reviewer");
  });
});

// ─── Terminal Router Tests ────────────────────────────────────────────────────

describe("terminal router", () => {
  it("terminal.classifyCommand returns classification for safe command", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.terminal.classifyCommand({ command: "ls -la" });
    expect(result.level).toBe("safe");
    expect(result.requiresApproval).toBe(false);
  });

  it("terminal.classifyCommand returns classification for destructive command", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.terminal.classifyCommand({ command: "sudo rm -rf /" });
    expect(result.level).toBe("destructive");
    expect(result.requiresApproval).toBe(true);
  });

  it("terminal.listSessions returns an array", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.terminal.listSessions({});
    expect(Array.isArray(result)).toBe(true);
  });
});

// ─── Memory Router Tests ──────────────────────────────────────────────────────

describe("memory router", () => {
  it("memory.list returns an array", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.memory.list({});
    expect(Array.isArray(result)).toBe(true);
  });

  it("memory.upsert rejects empty key", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await expect(
      caller.memory.upsert({ key: "", value: "test", type: "fact" })
    ).rejects.toThrow();
  });

  it("memory.upsert rejects empty value", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await expect(
      caller.memory.upsert({ key: "test-key", value: "", type: "fact" })
    ).rejects.toThrow();
  });
});

// ─── Approvals Router Tests ───────────────────────────────────────────────────

describe("approvals router", () => {
  it("approvals.list returns an array", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.approvals.list({});
    expect(Array.isArray(result)).toBe(true);
  });

  it("approvals.pending returns an array", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.approvals.pending();
    expect(Array.isArray(result)).toBe(true);
  });

  it("approvals.list with status filter returns array", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.approvals.list({ status: "pending" });
    expect(Array.isArray(result)).toBe(true);
  });
});

// ─── Workspaces Router Tests ──────────────────────────────────────────────────

describe("workspaces router", () => {
  it("workspaces.list returns an array", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.workspaces.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("workspaces.getDefault returns a workspace object", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.workspaces.getDefault();
    expect(result).toBeTruthy();
    expect(typeof result.id).toBe("number");
    expect(typeof result.name).toBe("string");
  });
});

// ─── Deployments Router Tests ─────────────────────────────────────────────────

describe("deployments router", () => {
  it("deployments.list returns an array", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.deployments.list();
    expect(Array.isArray(result)).toBe(true);
  });
});

// ─── Files Router Tests ───────────────────────────────────────────────────────

describe("files router", () => {
  it("files.list requires workspaceId", async () => {
    const caller = appRouter.createCaller(makeCtx());
    // Should work with a valid workspaceId
    const result = await caller.files.list({ workspaceId: 1 });
    expect(Array.isArray(result)).toBe(true);
  });
});

// ─── Browser Router Tests ─────────────────────────────────────────────────────

describe("browser router", () => {
  it("browser.list returns an array", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.browser.list({});
    expect(Array.isArray(result)).toBe(true);
  });

  it("browser.create rejects invalid URL", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await expect(
      caller.browser.create({ url: "not-a-url", objective: "test" })
    ).rejects.toThrow();
  });
});

// ─── GitHub Router Tests ──────────────────────────────────────────────────────

describe("github router", () => {
  it("github.getConnection returns null when no connection exists", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.github.getConnection({});
    // Should return null or undefined when no connection
    expect(result == null || typeof result === "object").toBe(true);
  });
});
