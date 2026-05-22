import { nanoid } from "nanoid";
import { invokeLLM } from "./_core/llm";
import {
  getAgentByRole,
  getMission,
  insertMissionEvent,
  updateAgent,
  updateMission,
} from "./db";
import { classifyCommand } from "./riskClassifier";
import sseEmitter from "./sseEmitter";
import type { AgentRole, MissionPlanStep } from "../drizzle/schema";

// ─── Plan Generation ──────────────────────────────────────────────────────────
export async function generateMissionPlan(
  missionId: number,
  goal: string,
  userId: number
): Promise<MissionPlanStep[]> {
  await updateMission(missionId, { status: "planning" });
  await emitEvent(missionId, "status_change", "planner", { status: "planning", message: "Generating execution plan…" });

  const plannerAgent = await getAgentByRole(userId, "planner");
  if (plannerAgent) {
    await updateAgent(plannerAgent.id, { status: "active", currentMissionId: missionId, currentTask: "Generating plan" });
  }

  const systemPrompt = `You are an autonomous AI mission planner. Given a high-level goal, produce a structured execution plan as a JSON array of steps. Each step must include:
- id: unique string
- order: integer starting from 1
- title: short step title (max 60 chars)
- description: what this step accomplishes (1-2 sentences)
- agentRole: one of "planner" | "researcher" | "writer" | "coder" | "reviewer"
- estimatedDuration: human-readable estimate (e.g. "2 minutes", "30 seconds")
- status: always "pending"
- tools: array of tool names that will be used (e.g. ["web_search", "terminal", "file_write"])

Return ONLY a valid JSON array. No markdown, no explanation.`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Mission goal: ${goal}` },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "mission_plan",
        strict: true,
        schema: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              order: { type: "integer" },
              title: { type: "string" },
              description: { type: "string" },
              agentRole: { type: "string", enum: ["planner", "researcher", "writer", "coder", "reviewer"] },
              estimatedDuration: { type: "string" },
              status: { type: "string", enum: ["pending"] },
              tools: { type: "array", items: { type: "string" } },
            },
            required: ["id", "order", "title", "description", "agentRole", "estimatedDuration", "status", "tools"],
            additionalProperties: false,
          },
        },
      },
    },
  });

  let plan: MissionPlanStep[] = [];
  try {
    const rawContent = response.choices[0]?.message?.content;
    const raw = typeof rawContent === "string" ? rawContent : "[]";
    plan = JSON.parse(raw);
    // Ensure IDs are unique
    plan = plan.map((step, i) => ({ ...step, id: step.id || nanoid(), order: i + 1 }));
  } catch {
    plan = [
      {
        id: nanoid(),
        order: 1,
        title: "Execute mission goal",
        description: goal,
        agentRole: "planner",
        estimatedDuration: "5 minutes",
        status: "pending",
        tools: ["terminal", "file_write"],
      },
    ];
  }

  const agentRoles = Array.from(new Set(plan.map((s) => s.agentRole))) as AgentRole[];
  const tokensUsed = response.usage?.total_tokens ?? 0;

  await updateMission(missionId, {
    plan,
    agentRoles,
    status: "awaiting_approval",
    tokensUsed,
  });

  if (plannerAgent) {
    await updateAgent(plannerAgent.id, {
      status: "idle",
      currentTask: null,
      tokensUsed: (plannerAgent.tokensUsed ?? 0) + tokensUsed,
      tasksCompleted: (plannerAgent.tasksCompleted ?? 0) + 1,
    });
  }

  await emitEvent(missionId, "status_change", "planner", {
    status: "awaiting_approval",
    message: `Plan ready with ${plan.length} steps. Awaiting your approval.`,
    plan,
  });

  return plan;
}

// ─── Mission Execution ────────────────────────────────────────────────────────
export async function executeMission(missionId: number, userId: number): Promise<void> {
  const mission = await getMission(missionId);
  if (!mission || !mission.plan) return;

  await updateMission(missionId, { status: "executing" });
  await emitEvent(missionId, "status_change", null, { status: "executing", message: "Mission execution started." });

  const plan = mission.plan as MissionPlanStep[];
  let totalTokens = mission.tokensUsed ?? 0;

  for (let i = 0; i < plan.length; i++) {
    const step = plan[i]!;
    // Check if mission was paused or stopped
    const current = await getMission(missionId);
    if (!current || current.status === "paused" || current.status === "failed") {
      await emitEvent(missionId, "status_change", null, { status: current?.status ?? "failed", message: "Mission halted." });
      return;
    }

    // Update step status to in_progress
    plan[i] = { ...step, status: "in_progress" };
    await updateMission(missionId, { plan });
    await emitEvent(missionId, "action", step.agentRole, {
      stepId: step.id,
      stepTitle: step.title,
      message: `Starting: ${step.title}`,
    });

    // Activate the agent for this step
    const agent = await getAgentByRole(userId, step.agentRole);
    if (agent) {
      await updateAgent(agent.id, { status: "active", currentMissionId: missionId, currentTask: step.title });
    }

    // Execute the step via LLM
    try {
      const result = await executeStep(missionId, step, mission.goal, userId);
      plan[i] = { ...plan[i]!, status: "completed", output: result.summary };
      totalTokens += result.tokensUsed;
      await updateMission(missionId, { plan, tokensUsed: totalTokens });
      await emitEvent(missionId, "thought", step.agentRole, {
        stepId: step.id,
        message: result.summary,
        tokensUsed: result.tokensUsed,
      });
    } catch (err) {
      plan[i] = { ...plan[i]!, status: "failed" };
      await updateMission(missionId, { plan, status: "failed", errorMessage: String(err) });
      await emitEvent(missionId, "error", step.agentRole, {
        stepId: step.id,
        message: `Step failed: ${String(err)}`,
      });
      if (agent) {
        await updateAgent(agent.id, { status: "error", currentTask: null });
      }
      return;
    }

    if (agent) {
      await updateAgent(agent.id, {
        status: "idle",
        currentTask: null,
        tokensUsed: (agent.tokensUsed ?? 0) + totalTokens,
        tasksCompleted: (agent.tasksCompleted ?? 0) + 1,
      });
    }
  }

  // Generate executive summary
  const summary = await generateExecutiveSummary(missionId, mission.goal, plan, userId);
  totalTokens += summary.tokensUsed;

  await updateMission(missionId, {
    status: "completed",
    summary: summary.text,
    tokensUsed: totalTokens,
    completedAt: new Date(),
  });

  await emitEvent(missionId, "summary", null, {
    status: "completed",
    summary: summary.text,
    tokensUsed: totalTokens,
    message: "Mission completed successfully.",
  });
}

// ─── Step Execution ───────────────────────────────────────────────────────────
async function executeStep(
  missionId: number,
  step: MissionPlanStep,
  missionGoal: string,
  userId: number
): Promise<{ summary: string; tokensUsed: number }> {
  const agentPrompts: Record<AgentRole, string> = {
    planner: "You are a strategic planner. Analyze the step and produce a clear execution plan with concrete actions.",
    researcher: "You are a research specialist. Gather relevant information, identify key facts, and synthesize findings.",
    writer: "You are a content writer. Produce clear, well-structured written output for the step.",
    coder: "You are a software engineer. Write clean, functional code or technical implementation for the step.",
    reviewer: "You are a quality reviewer. Evaluate the work done, identify issues, and provide improvement recommendations.",
  };

  // Emit a thought event before calling LLM
  await emitEvent(missionId, "thought", step.agentRole, {
    stepId: step.id,
    message: `Analyzing: ${step.description}`,
  });

  const response = await invokeLLM({
    messages: [
      { role: "system", content: agentPrompts[step.agentRole] },
      {
        role: "user",
        content: `Mission goal: ${missionGoal}\n\nCurrent step: ${step.title}\n\nStep description: ${step.description}\n\nTools available: ${step.tools.join(", ")}\n\nProvide a concise execution summary (2-4 sentences) describing what was accomplished in this step.`,
      },
    ],
  });

  const rawSummary = response.choices[0]?.message?.content;
  const summary = typeof rawSummary === "string" ? rawSummary : `Completed: ${step.title}`;
  const tokensUsed = response.usage?.total_tokens ?? 0;

  // Emit tool_call events for each tool in the step
  for (const tool of step.tools.slice(0, 2)) {
    await emitEvent(missionId, "tool_call", step.agentRole, {
      stepId: step.id,
      tool,
      message: `Using tool: ${tool}`,
    });
  }

  // Store the event in DB
  await insertMissionEvent({
    missionId,
    agentRole: step.agentRole,
    type: "action",
    payload: { stepId: step.id, title: step.title, summary, tokensUsed },
  });

  return { summary, tokensUsed };
}

// ─── Executive Summary ────────────────────────────────────────────────────────
async function generateExecutiveSummary(
  missionId: number,
  goal: string,
  plan: MissionPlanStep[],
  userId: number
): Promise<{ text: string; tokensUsed: number }> {
  const reviewerAgent = await getAgentByRole(userId, "reviewer");
  if (reviewerAgent) {
    await updateAgent(reviewerAgent.id, { status: "active", currentMissionId: missionId, currentTask: "Writing summary" });
  }

  await emitEvent(missionId, "thought", "reviewer", { message: "Generating executive summary…" });

  const completedSteps = plan.filter((s) => s.status === "completed");
  const stepSummaries = completedSteps.map((s) => `- ${s.title}: ${s.output ?? "completed"}`).join("\n");

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: "You are an executive summarizer. Write a concise, professional summary of a completed mission. Focus on outcomes, not technical details. 3-5 sentences maximum.",
      },
      {
        role: "user",
        content: `Mission goal: ${goal}\n\nCompleted steps:\n${stepSummaries}\n\nWrite the executive summary.`,
      },
    ],
  });

  const rawText = response.choices[0]?.message?.content;
  const text = typeof rawText === "string" ? rawText : `Mission completed: ${goal}`;
  const tokensUsed = response.usage?.total_tokens ?? 0;

  if (reviewerAgent) {
    await updateAgent(reviewerAgent.id, {
      status: "idle",
      currentTask: null,
      tokensUsed: (reviewerAgent.tokensUsed ?? 0) + tokensUsed,
      tasksCompleted: (reviewerAgent.tasksCompleted ?? 0) + 1,
    });
  }

  return { text, tokensUsed };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function emitEvent(
  missionId: number,
  type: string,
  agentRole: string | null,
  payload: Record<string, unknown>
): Promise<void> {
  sseEmitter.broadcast(missionId, type, { agentRole, ...payload });
  try {
    await insertMissionEvent({
      missionId,
      agentRole: agentRole ?? undefined,
      type: type as never,
      payload,
    });
  } catch {
    // Non-fatal: SSE delivery is primary, DB persistence is secondary
  }
}

export { classifyCommand };
