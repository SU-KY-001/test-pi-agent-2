import {
  type HealthResponse,
  HealthResponseSchema,
  type QueueTestResponse,
  QueueTestResponseSchema,
  type PiTestResponse,
  PiTestResponseSchema,
} from "@repo/contracts";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE_URL}/health`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Health check returned status ${res.status}`);
  }
  const data: unknown = await res.json();
  const parsed = HealthResponseSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error("Invalid health response schema");
  }
  return parsed.data;
}

export async function testQueue(): Promise<QueueTestResponse> {
  const res = await fetch(`${API_BASE_URL}/queue/test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Queue test failed (${res.status}): ${errorText}`);
  }
  const data: unknown = await res.json();
  const parsed = QueueTestResponseSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error("Invalid queue test response schema");
  }
  return parsed.data;
}

export async function testPi(): Promise<PiTestResponse> {
  const res = await fetch(`${API_BASE_URL}/pi/test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  const data: unknown = await res.json();
  if (!res.ok) {
    if (data && typeof data === "object" && "error" in data) {
      throw new Error(String(data.error));
    }
    throw new Error(`Pi test failed with status ${res.status}`);
  }
  const parsed = PiTestResponseSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error("Invalid Pi test response schema");
  }
  return parsed.data;
}
