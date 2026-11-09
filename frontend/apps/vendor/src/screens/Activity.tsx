import { ApiError, api } from "@poolit/domain";
import type { AuditEntry, ClientErrorEntry } from "@poolit/domain";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Badge, Button, Card, EmptyState } from "../components/ui";
import { useIsAdmin } from "../hooks/useIsAdmin";

const TABLES = [
  "orders", "students", "student_consents", "slots", "menu_items", "vendors", "staff", "vendor_users",
  "vendor_fee_terms", "order_fee_ledger", "platform_admins", "stock_adjustments", "restock_logs", "hostels",
];
const PAGE = 50;

/** What changed, as "column: old → new" (or the new values for an insert). */
function summary(e: AuditEntry): string {
  const keys = Object.keys(e.new ?? e.old ?? {});
  if (e.op === "UPDATE") return keys.map((k) => `${k}: ${fmt(e.old?.[k])} → ${fmt(e.new?.[k])}`).join(", ");
  const src = e.new ?? e.old ?? {};
  return keys.slice(0, 6).map((k) => `${k}: ${fmt(src[k])}`).join(", ") + (keys.length > 6 ? ", …" : "");
}
const fmt = (v: unknown) => (v === null || v === undefined ? "–" : typeof v === "object" ? JSON.stringify(v) : String(v));

/** The activity log: who changed what and when. Poolit team only. */
export function Activity() {
  const admin = useIsAdmin();
  const [table, setTable] = useState("");
  const [rows, setRows] = useState<AuditEntry[]>([]);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [crashes, setCrashes] = useState<ClientErrorEntry[]>([]);

  const load = useCallback(
    async (before?: number) => {
      setLoading(true);
      setError(null);
      try {
        const page = await api.getAuditLog({ table: table || undefined, before, limit: PAGE });
        setRows((prev) => (before ? [...prev, ...page] : page));
        setMore(page.length === PAGE);
      } catch (err) {
        setError(err instanceof ApiError && err.status === 403 ? "Only the Poolit team can read the activity log." : err instanceof ApiError ? err.message : "Couldn't load the log.");
      } finally {
        setLoading(false);
      }
    },
    [table],
  );

  useEffect(() => {
    if (admin) void load();
  }, [admin, load]);

  useEffect(() => {
    if (!admin) return;
    api.getClientErrors(50).then(setCrashes).catch(() => setCrashes([]));
  }, [admin]);

  if (!admin) {
    return (
      <EmptyState
        icon="lock"
        title="Poolit team only"
        body="The activity log is visible to the Poolit team."
        action={<Link to="/settings" className="text-primary underline">Back to settings</Link>}
      />
    );
  }

  return (
    <div className="space-y-space-md">
      <Card icon="history" title="Activity log" subtitle="Every change to orders, items, stores, fees and accounts. Personal details show as ***. Kept 180 days.">
        <div className="flex flex-wrap items-center gap-space-xs">
          <select
            value={table}
            onChange={(e) => setTable(e.target.value)}
            aria-label="Filter by table"
            className="rounded-lg bg-surface-container-low px-space-sm py-1.5 text-body-md text-on-surface outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">All tables</option>
            {TABLES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <Button size="sm" icon="refresh" onClick={() => void load()} disabled={loading}>Refresh</Button>
        </div>
        {error && <p className="mt-space-sm text-body-sm text-error">{error}</p>}
      </Card>

      <Card icon="bug_report" title="Crash reports" subtitle="Errors the apps reported, merged by message and page. Kept 30 days.">
        {crashes.length === 0 ? (
          <p className="text-body-md text-secondary">No crashes reported.</p>
        ) : (
          <ul className="divide-y divide-surface-container-low">
            {crashes.map((c) => (
              <li key={`${c.app}|${c.page}|${c.message}`} className="py-space-xs">
                <div className="flex flex-wrap items-center gap-space-xs text-body-sm">
                  <Badge tone="error" dot={false}>{c.app}</Badge>
                  <span className="font-medium text-on-surface">{c.occurrences}×</span>
                  <span className="text-secondary">last {new Date(c.lastAt).toLocaleString("en-IN")}</span>
                  {c.page && <span className="font-mono text-label-sm text-secondary">{c.page}</span>}
                </div>
                <p className="break-words font-mono text-label-sm text-on-surface">{c.message}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card flush>
        {rows.length === 0 && !loading ? (
          <p className="p-space-md text-body-md text-secondary">Nothing recorded yet.</p>
        ) : (
          <ul className="divide-y divide-surface-container-low">
            {rows.map((e) => (
              <li key={e.id} className="space-y-0.5 px-space-md py-space-sm">
                <div className="flex flex-wrap items-center gap-space-xs text-body-sm">
                  <Badge tone={e.op === "DELETE" ? "error" : e.op === "INSERT" ? "ready" : "primary"} dot={false}>{e.op}</Badge>
                  <span className="font-medium text-on-surface">{e.table}</span>
                  <span className="text-secondary">{new Date(e.at).toLocaleString("en-IN")}</span>
                  <span className="text-secondary">by {e.actorEmail ?? (e.actor ? `user ${e.actor.slice(0, 8)}` : e.actorRole ? `system (${e.actorRole})` : "system")}</span>
                </div>
                <p className="break-words font-mono text-label-sm text-secondary">
                  {e.rowId ? `${e.rowId.slice(0, 8)} · ` : ""}
                  {summary(e)}
                </p>
              </li>
            ))}
          </ul>
        )}
        {more && (
          <div className="p-space-sm">
            <Button onClick={() => void load(rows[rows.length - 1]?.id)} disabled={loading}>Load older</Button>
          </div>
        )}
      </Card>
    </div>
  );
}
