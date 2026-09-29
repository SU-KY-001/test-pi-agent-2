"use client";

import { useEffect, useState } from "react";
import { fetchHealth, testQueue, testPi } from "../lib/api";
import type { HealthResponse } from "@repo/contracts";

export default function HomePage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [queueLoading, setQueueLoading] = useState<boolean>(false);
  const [queueOutput, setQueueOutput] = useState<string | null>(null);

  const [piLoading, setPiLoading] = useState<boolean>(false);
  const [piOutput, setPiOutput] = useState<string | null>(null);

  const refreshHealth = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchHealth();
      setHealth(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshHealth();
  }, []);

  const handleTestQueue = async () => {
    try {
      setQueueLoading(true);
      setQueueOutput("Sending job to pg-boss queue...");
      const res = await testQueue();
      setQueueOutput(`Job Enqueued! Job ID: ${res.jobId}\nWorker processing into PGlite system_events...`);
      await refreshHealth();
    } catch (err) {
      setQueueOutput(`Queue Test Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setQueueLoading(false);
    }
  };

  const handleTestPi = async () => {
    try {
      setPiLoading(true);
      setPiOutput("Creating ephemeral Pi session and prompting model for 'PONG'...");
      const res = await testPi();
      setPiOutput(`Model Response: ${res.response}\nProvider: ${res.provider} | Model: ${res.model}`);
      await refreshHealth();
    } catch (err) {
      setPiOutput(`Pi Test Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setPiLoading(false);
    }
  };

  return (
    <div className="container">
      <h1>Sử Ký Agent Stack Demo</h1>

      <div className="status-grid">
        <div className="status-row">
          <span className="service-name">Web</span>
          <span className="badge badge-ok">✓ OK</span>
        </div>

        <div className="status-row">
          <span className="service-name">API</span>
          {loading ? (
            <span className="badge badge-pending">...</span>
          ) : health?.services.api ? (
            <span className="badge badge-ok">✓ OK</span>
          ) : (
            <span className="badge badge-error">✗ Offline</span>
          )}
        </div>

        <div className="status-row">
          <span className="service-name">PGlite</span>
          {loading ? (
            <span className="badge badge-pending">...</span>
          ) : health?.services.database ? (
            <span className="badge badge-ok">✓ OK</span>
          ) : (
            <span className="badge badge-error">✗ Unavailable</span>
          )}
        </div>

        <div className="status-row">
          <span className="service-name">Drizzle</span>
          {loading ? (
            <span className="badge badge-pending">...</span>
          ) : health?.services.database ? (
            <span className="badge badge-ok">✓ OK</span>
          ) : (
            <span className="badge badge-error">✗ Unavailable</span>
          )}
        </div>

        <div className="status-row">
          <span className="service-name">pg-boss</span>
          {loading ? (
            <span className="badge badge-pending">...</span>
          ) : health?.services.queue ? (
            <span className="badge badge-ok">✓ OK</span>
          ) : (
            <span className="badge badge-error">✗ Offline</span>
          )}
        </div>

        <div className="status-row">
          <span className="service-name">Pi SDK</span>
          {loading ? (
            <span className="badge badge-pending">...</span>
          ) : health?.services.api ? (
            <span className="badge badge-ok">✓ Loaded</span>
          ) : (
            <span className="badge badge-error">✗ Unloaded</span>
          )}
        </div>

        <div className="status-row">
          <span className="service-name">OpenCode Go</span>
          {loading ? (
            <span className="badge badge-pending">...</span>
          ) : health?.services.pi ? (
            <span className="badge badge-ok">✓ Configured</span>
          ) : (
            <span className="badge badge-pending">! Key Required</span>
          )}
        </div>
      </div>

      <div className="actions">
        <button onClick={handleTestQueue} disabled={queueLoading}>
          {queueLoading ? "Testing Queue..." : "[Test Queue]"}
        </button>
        <button onClick={handleTestPi} disabled={piLoading}>
          {piLoading ? "Testing Pi SDK..." : "[Test Pi]"}
        </button>
      </div>

      {(queueOutput || piOutput || error) && (
        <div className="output-box">
          <div className="output-title">Console Output:</div>
          {error && <div style={{ color: "var(--error)" }}>{`Error: ${error}`}</div>}
          {queueOutput && <div>{queueOutput}</div>}
          {piOutput && <div>{piOutput}</div>}
        </div>
      )}
    </div>
  );
}
