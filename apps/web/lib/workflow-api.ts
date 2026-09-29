import {
  type CreateWorkflowResponse,
  CreateWorkflowResponseSchema,
  type GetWorkflowResponse,
  GetWorkflowResponseSchema,
} from "@repo/contracts";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

async function parseOrThrow<T>(
  res: Response,
  parse: (data: unknown) => { success: boolean; data?: T },
  label: string
): Promise<T> {
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const detail =
      data && typeof data === "object" && "error" in data ? String(data.error) : await Promise.resolve(res.statusText);
    throw new Error(`${label} failed (${res.status}): ${detail}`);
  }
  const parsed = parse(data);
  if (!parsed.success || parsed.data == null) throw new Error(`Invalid ${label} response schema`);
  return parsed.data;
}

export async function createWorkflow(rawProductText: string): Promise<CreateWorkflowResponse> {
  const res = await fetch(`${API_BASE_URL}/workflows`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rawProductText }),
  });
  return parseOrThrow(res, (d) => CreateWorkflowResponseSchema.safeParse(d), "Create workflow");
}

export async function fetchWorkflow(id: number): Promise<GetWorkflowResponse> {
  const res = await fetch(`${API_BASE_URL}/workflows/${id}`, { cache: "no-store" });
  return parseOrThrow(res, (d) => GetWorkflowResponseSchema.safeParse(d), "Fetch workflow");
}

export async function regeneratePlanner(id: number, feedback: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/workflows/${id}/planner/regenerate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ feedback }),
  });
  await parseOrThrow(res, (d) => ({ success: true as const, data: d as unknown }), "Regenerate planner");
}

export async function approvePlanner(id: number, version: number): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/workflows/${id}/planner/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ version }),
  });
  await parseOrThrow(res, (d) => ({ success: true as const, data: d as unknown }), "Approve planner");
}
