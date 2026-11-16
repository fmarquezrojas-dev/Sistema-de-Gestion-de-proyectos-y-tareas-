import type { Project, Task } from "../types";
import { useEffect, useCallback, useState, useMemo, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/authState";
import Navbar from "../components/Navbar";
import api from "../services/api";

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface ActivityItem {
  id: string | number;
  type: string;
  description: string;
  createdAt?: string;
  timestamp?: string;
  user?: { name: string };
  userName?: string;
  projectName?: string;
  project?: { name: string };
  taskTitle?: string;
  taskStatus?: string;
  taskPriority?: string;
}

interface DashboardData {
  summary: {
    totalProjects: number;
    totalTasks: number;
    completedTasks: number;
    pendingTasks: number;
    inProgressTasks?: number;
    overdueTasks: number;
  };
  activeProjects: Project[];
  myPendingTasks: Task[];
  overdueTasks: Task[];
  upcomingTasks: Task[];
  recentActivity: ActivityItem[];
}

// ─── Metadatos ────────────────────────────────────────────────────────────────
const ACTIVITY_META: Record<
  string,
  { icon: string; color: string; bg: string; label: string }
> = {
  TASK_CREATED: {
    icon: "➕",
    color: "#4f46e5",
    bg: "#ede9fe",
    label: "Tarea creada",
  },
  TASK_COMPLETED: {
    icon: "🏁",
    color: "#16a34a",
    bg: "#dcfce7",
    label: "Completada",
  },
  TASK_UPDATED: {
    icon: "✏️",
    color: "#0891b2",
    bg: "#cffafe",
    label: "Editada",
  },
  TASK_DELETED: {
    icon: "🗑️",
    color: "#ef4444",
    bg: "#fee2e2",
    label: "Eliminada",
  },
  PROJECT_CREATED: {
    icon: "📁",
    color: "#7c3aed",
    bg: "#f3e8ff",
    label: "Proyecto creado",
  },
  PROJECT_UPDATED: {
    icon: "🔧",
    color: "#d97706",
    bg: "#fef3c7",
    label: "Proyecto editado",
  },
  MEMBER_ADDED: {
    icon: "👥",
    color: "#0284c7",
    bg: "#e0f2fe",
    label: "Miembro añadido",
  },
  DEFAULT: { icon: "🔔", color: "#6b7280", bg: "#f3f4f6", label: "Actividad" },
};
const TASK_STATUS_META: Record<
  string,
  { color: string; bg: string; label: string }
> = {
  PENDING: { color: "#b45309", bg: "#fef3c7", label: "Pendiente" },
  IN_PROGRESS: { color: "#1d4ed8", bg: "#dbeafe", label: "En progreso" },
  COMPLETED: { color: "#15803d", bg: "#dcfce7", label: "Completada" },
};
const PRIORITY_META: Record<
  string,
  { color: string; bg: string; label: string }
> = {
  HIGH: { color: "#fff", bg: "#ef4444", label: "Alta" },
  MEDIUM: { color: "#fff", bg: "#f59e0b", label: "Media" },
  LOW: { color: "#fff", bg: "#22c55e", label: "Baja" },
};
const getActivityMeta = (type: string) =>
  ACTIVITY_META[type] ?? ACTIVITY_META.DEFAULT;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const timeAgo = (dateStr?: string): string => {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Ahora";
  if (mins < 60) return `Hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Hace ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Ayer";
  if (days < 7) return `Hace ${days}d`;
  return new Date(dateStr).toLocaleDateString("es", {
    day: "2-digit",
    month: "short",
  });
};

const formatTime = (dateStr: string) =>
  new Date(dateStr)
    .toLocaleTimeString("es-PE", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })
    .toUpperCase();

/**
 * ✅ FIX: Compara días de calendario, no milisegundos divididos.
 * Esto evita el bug donde "hoy a las 11pm" muestra "Mañana".
 */
const getDayLabel = (
  dueDateStr: string,
  now: Date,
): { label: string; color: string; expired: boolean } => {
  const due = new Date(dueDateStr);
  const diffMs = due.getTime() - now.getTime();
  if (diffMs < 0) return { label: "Vencida", color: "#ef4444", expired: true };

  // Comparar días de calendario (sin hora)
  const todayMidnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const dueMidnight = new Date(
    due.getFullYear(),
    due.getMonth(),
    due.getDate(),
  );
  const daysDiff = Math.round(
    (dueMidnight.getTime() - todayMidnight.getTime()) / 86_400_000,
  );

  if (daysDiff === 0) return { label: "Hoy", color: "#f59e0b", expired: false };
  if (daysDiff === 1)
    return { label: "Mañana", color: "#fb923c", expired: false };
  if (daysDiff <= 3)
    return { label: `${daysDiff}d`, color: "#fb923c", expired: false };
  return { label: `${daysDiff}d`, color: "#22c55e", expired: false };
};

const getMinutesLeft = (d: string) =>
  Math.floor((new Date(d).getTime() - Date.now()) / 60_000);

// ─── Gráfico Dona mejorado ────────────────────────────────────────────────────
const DonutChart = ({
  pending,
  inProgress,
  completed,
  overdue,
}: {
  pending: number;
  inProgress: number;
  completed: number;
  overdue: number;
}) => {
  const total =
    Math.max(0, pending) + Math.max(0, inProgress) + Math.max(0, completed);

  if (total === 0)
    return (
      <div style={{ textAlign: "center", padding: "2rem 0" }}>
        <p style={{ fontSize: "2.5rem", margin: 0 }}>📭</p>
        <p
          style={{
            fontSize: "0.82rem",
            color: "var(--text-muted)",
            margin: "0.5rem 0 0",
          }}
        >
          Sin tareas aún
        </p>
      </div>
    );

  const size = 148,
    sw = 20;
  const r = (size - sw) / 2,
    circ = 2 * Math.PI * r;
  const cx = size / 2,
    cy = size / 2;
  const segments = [
    {
      value: Math.max(0, pending),
      color: "#f59e0b",
      label: "Pendientes",
      count: pending,
    },
    {
      value: Math.max(0, inProgress),
      color: "#6366f1",
      label: "En progreso",
      count: inProgress,
    },
    {
      value: Math.max(0, completed),
      color: "#22c55e",
      label: "Completadas",
      count: completed,
    },
  ];
  let offset = 0;
  const arcs = segments.map((seg) => {
    const dash = (seg.value / total) * circ;
    const arc = { ...seg, dash, offset: circ - offset };
    offset += dash;
    return arc;
  });

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "1.5rem",
        flexWrap: "wrap",
      }}
    >
      <div style={{ position: "relative", flexShrink: 0, margin: "0 auto" }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="var(--border-color)"
            strokeWidth={sw}
          />
          {arcs.map(
            (arc, i) =>
              arc.value > 0 && (
                <circle
                  key={i}
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill="none"
                  stroke={arc.color}
                  strokeWidth={sw}
                  strokeDasharray={`${arc.dash} ${circ - arc.dash}`}
                  strokeDashoffset={arc.offset}
                  strokeLinecap="round"
                  style={{ transition: "stroke-dasharray 0.6s ease" }}
                />
              ),
          )}
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              fontSize: "1.6rem",
              fontWeight: 800,
              color: "var(--text-primary)",
              lineHeight: 1,
            }}
          >
            {total}
          </span>
          <span
            style={{
              fontSize: "0.62rem",
              color: "var(--text-muted)",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            tareas
          </span>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.6rem",
          flex: 1,
        }}
      >
        {segments.map((seg, i) => (
          <div
            key={i}
            style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
          >
            <div
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                background: seg.color,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: "0.8rem",
                color: "var(--text-secondary)",
                flex: 1,
              }}
            >
              {seg.label}
            </span>
            <span
              style={{
                fontSize: "0.88rem",
                fontWeight: 800,
                color: "var(--text-primary)",
              }}
            >
              {seg.count}
            </span>
          </div>
        ))}
        <div
          style={{
            height: "1px",
            background: "var(--border-light)",
            margin: "0.1rem 0",
          }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <div
            style={{
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              background: "#ef4444",
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: "0.8rem",
              color: "var(--text-secondary)",
              flex: 1,
            }}
          >
            Vencidas
          </span>
          <span
            style={{
              fontSize: "0.88rem",
              fontWeight: 800,
              color: overdue > 0 ? "#ef4444" : "var(--text-primary)",
            }}
          >
            {overdue}
          </span>
        </div>
      </div>
    </div>
  );
};

// ─── Actividad Reciente ───────────────────────────────────────────────────────
const RecentActivity = ({ items }: { items: ActivityItem[] }) => {
  if (!items?.length)
    return (
      <div style={{ textAlign: "center", padding: "2rem 0" }}>
        <p style={{ fontSize: "2rem", margin: 0 }}>📭</p>
        <p
          style={{
            fontSize: "0.82rem",
            color: "var(--text-muted)",
            margin: "0.4rem 0 0",
          }}
        >
          Sin actividad reciente
        </p>
      </div>
    );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
      {items.map((item, index) => {
        const meta = getActivityMeta(item.type);
        const dateStr = item.createdAt ?? item.timestamp;
        const actor = item.user?.name ?? item.userName ?? "Sistema";
        const project = item.project?.name ?? item.projectName;
        const statusM = item.taskStatus
          ? TASK_STATUS_META[item.taskStatus]
          : null;
        const priorM = item.taskPriority
          ? PRIORITY_META[item.taskPriority]
          : null;
        const isLast = index === items.length - 1;

        return (
          <div
            key={item.id ?? index}
            style={{
              display: "flex",
              gap: "0.85rem",
              alignItems: "flex-start",
              padding: "0.85rem 0",
              borderBottom: isLast ? "none" : "1px solid var(--border-light)",
            }}
          >
            <div
              style={{
                width: "34px",
                height: "34px",
                borderRadius: "50%",
                background: meta.bg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.9rem",
                flexShrink: 0,
              }}
            >
              {meta.icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              {item.taskTitle && (
                <p
                  style={{
                    margin: "0 0 0.1rem",
                    fontSize: "0.87rem",
                    fontWeight: 600,
                    color: "#1e293b",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.taskTitle}
                </p>
              )}
              <p
                style={{
                  margin: "0 0 0.3rem",
                  fontSize: item.taskTitle ? "0.77rem" : "0.85rem",
                  color: item.taskTitle ? "#64748b" : "var(--text-secondary)",
                  fontWeight: item.taskTitle ? 400 : 500,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {item.description}
              </p>
              <div
                style={{
                  display: "flex",
                  gap: "0.3rem",
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    fontSize: "0.66rem",
                    fontWeight: 700,
                    color: meta.color,
                    background: meta.bg,
                    padding: "0.1rem 0.45rem",
                    borderRadius: "999px",
                    border: `1px solid ${meta.color}33`,
                  }}
                >
                  {meta.label}
                </span>
                {statusM && (
                  <span
                    style={{
                      fontSize: "0.66rem",
                      fontWeight: 600,
                      color: statusM.color,
                      background: statusM.bg,
                      padding: "0.1rem 0.45rem",
                      borderRadius: "999px",
                      border: `1px solid ${statusM.color}33`,
                    }}
                  >
                    {statusM.label}
                  </span>
                )}
                {priorM && (
                  <span
                    style={{
                      fontSize: "0.66rem",
                      fontWeight: 600,
                      color: priorM.color,
                      background: priorM.bg,
                      padding: "0.1rem 0.45rem",
                      borderRadius: "999px",
                    }}
                  >
                    {priorM.label}
                  </span>
                )}
                <span style={{ fontSize: "0.67rem", color: "#94a3b8" }}>
                  por{" "}
                  <strong style={{ color: "var(--text-secondary)" }}>
                    {actor}
                  </strong>
                </span>
                {project && (
                  <span style={{ fontSize: "0.67rem", color: "#94a3b8" }}>
                    · 📁 {project}
                  </span>
                )}
              </div>
            </div>
            <span
              style={{
                fontSize: "0.67rem",
                color: "var(--text-muted)",
                whiteSpace: "nowrap",
                flexShrink: 0,
                marginTop: "0.1rem",
              }}
            >
              {timeAgo(dateStr)}
            </span>
          </div>
        );
      })}
    </div>
  );
};

// ─── Panel genérico ───────────────────────────────────────────────────────────
const Panel = ({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) => (
  <div
    style={{
      background: "var(--bg-card)",
      borderRadius: "14px",
      padding: "1.5rem",
      boxShadow: "var(--shadow-card)",
      border: "1px solid var(--border-color)",
      ...style,
    }}
  >
    {children}
  </div>
);

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h2
    style={{
      fontSize: "0.92rem",
      fontWeight: 700,
      color: "var(--text-primary)",
      margin: "0 0 1rem",
      textTransform: "uppercase",
      letterSpacing: "0.04em",
      display: "flex",
      alignItems: "center",
      gap: "0.4rem",
    }}
  >
    {children}
  </h2>
);

// ─── Dashboard Principal ──────────────────────────────────────────────────────
const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => new Date());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(tick);
  }, []);

  const fetchDashboard = useCallback(() => api.get("/dashboard").then(res => {
    setData(res.data?.data || res.data);
  }).catch(() => navigate("/login")).finally(() => setLoading(false)), [navigate]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  useEffect(() => {
    intervalRef.current = setInterval(() => fetchDashboard(), 60_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchDashboard]);

  const getProgress = (project: Project) => {
    const tasks = project.tasks || [];
    if (!tasks.length) return 0;
    return Math.round(
      (tasks.filter((t) => t.status === "COMPLETED").length /
        tasks.length) *
        100,
    );
  };
  const getProgressColor = (pct: number) =>
    pct < 20 ? "#ef4444" : pct < 70 ? "#f59e0b" : "#22c55e";

  const priorityColor: Record<string, string> = {
    HIGH: "#ef4444",
    MEDIUM: "#f59e0b",
    LOW: "#22c55e",
  };

  const realtimeOverdueCount = useMemo(() => {
    if (!data) return 0;
    const serverCount =
      data.summary?.overdueTasks ?? data.overdueTasks?.length ?? 0;
    const serverIds = new Set((data.overdueTasks ?? []).map((t) => t.id));
    const sessionNew = (data.upcomingTasks ?? []).filter(
      (t) =>
        t.dueDate &&
        t.status !== "COMPLETED" &&
        !serverIds.has(t.id) &&
        new Date(t.dueDate) < now,
    ).length;
    return serverCount + sessionNew;
  }, [data, now]);

  const criticalAlerts = useMemo(() => {
    if (!data) return [];
    const all = [...(data.myPendingTasks ?? []), ...(data.overdueTasks ?? [])];
    const seen = new Set<number>();
    return all.filter((t) => {
      if (seen.has(t.id) || !t.dueDate || t.status === "COMPLETED")
        return false;
      seen.add(t.id);
      const mins = Math.floor((new Date(t.dueDate!).getTime() - now.getTime()) / 60000);
      return mins < 0 || mins <= 60;
    });
  }, [data, now]);

  const allOverdueTasks = useMemo(() => {
    if (!data) return [];
    const serverOverdue = data.overdueTasks ?? [];
    const serverIds = new Set(serverOverdue.map((t) => t.id));
    const sessionNew = (data.upcomingTasks ?? []).filter(
      (t) =>
        t.dueDate &&
        t.status !== "COMPLETED" &&
        !serverIds.has(t.id) &&
        new Date(t.dueDate) < now,
    );
    return [...serverOverdue, ...sessionNew];
  }, [data, now]);

  if (loading)
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "var(--bg-app)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              border: "3px solid var(--border-color)",
              borderTop: "3px solid #6366f1",
              borderRadius: "50%",
              margin: "0 auto 1rem",
              animation: "spin 0.8s linear infinite",
            }}
          />
          <p style={{ color: "#94a3b8", fontSize: "0.9rem" }}>
            Cargando tu dashboard...
          </p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );

  const summary = data?.summary;
  const pendingCount = summary?.pendingTasks ?? 0;
  const inProgressCount = summary?.inProgressTasks ?? 0;
  const completedCount = summary?.completedTasks ?? 0;
  const firstName = user?.name ? user.name.split(" ")[0] : "Usuario";

  const hour = now.getHours();
  const greeting =
    hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-app)" }}>
      <Navbar />

      <div
        style={{
          padding: "2rem 5%",
          maxWidth: "1440px",
          margin: "0 auto",
          boxSizing: "border-box" as const,
        }}
      >
        {/* ── Header Hero ── */}
        <div
          style={{
            background:
              "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%)",
            borderRadius: "18px",
            padding: "2rem 2.5rem",
            marginBottom: "1.5rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "1rem",
            boxShadow: "0 8px 32px rgba(99,102,241,0.18)",
          }}
        >
          <div>
            <p
              style={{
                color: "#a5b4fc",
                fontSize: "0.85rem",
                margin: "0 0 0.35rem",
                fontWeight: 500,
              }}
            >
              {greeting} ·{" "}
              {now.toLocaleDateString("es-PE", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </p>
            <h1
              style={{
                color: "#fff",
                fontSize: "1.75rem",
                fontWeight: 800,
                margin: "0 0 0.4rem",
                letterSpacing: "-0.02em",
              }}
            >
              Hola, {firstName} 👋
            </h1>
            <p style={{ color: "#c7d2fe", fontSize: "0.88rem", margin: 0 }}>
              {summary?.totalTasks ?? 0} tareas en {summary?.totalProjects ?? 0}{" "}
              proyectos activos
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.85rem" }}>
            <Link
              to="/projects/new"
              style={{
                background: "#6366f1",
                color: "#fff",
                textDecoration: "none",
                padding: "0.6rem 1.25rem",
                borderRadius: "10px",
                fontSize: "0.85rem",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
              }}
            >
              + Nuevo proyecto
            </Link>
          </div>
        </div>

        {/* ── Alertas ── */}
        {criticalAlerts.length > 0 && (
          <div
            style={{
              background: "#fff7ed",
              border: "1px solid #fed7aa",
              borderLeft: "4px solid #f97316",
              borderRadius: "12px",
              padding: "1rem 1.25rem",
              marginBottom: "1rem",
              display: "flex",
              gap: "0.85rem",
              alignItems: "flex-start",
            }}
          >
            <span style={{ fontSize: "1.2rem", flexShrink: 0 }}>⚠️</span>
            <div>
              <p
                style={{
                  margin: "0 0 0.4rem",
                  fontWeight: 700,
                  fontSize: "0.9rem",
                  color: "#9a3412",
                }}
              >
                {criticalAlerts.length} tarea
                {criticalAlerts.length > 1 ? "s" : ""} urgente
                {criticalAlerts.length > 1 ? "s" : ""}
              </p>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                {criticalAlerts.map((t) => {
                  const mins = Math.floor((new Date(t.dueDate!).getTime() - now.getTime()) / 60000);
                  return (
                    <span
                      key={t.id}
                      style={{
                        fontSize: "0.77rem",
                        background: "#fef3c7",
                        color: "#92400e",
                        padding: "0.2rem 0.65rem",
                        borderRadius: "999px",
                        fontWeight: 500,
                      }}
                    >
                      {mins < 0 ? "🔴" : "🟡"} {t.title} —{" "}
                      {mins < 0
                        ? `venció hace ${Math.abs(mins)} min`
                        : `vence en ${mins} min`}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── KPI Cards ── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "1rem",
            marginBottom: "1.5rem",
          }}
        >
          {[
            {
              label: "Proyectos",
              value: summary?.totalProjects ?? 0,
              icon: "📁",
              color: "#6366f1",
              bg: "#eef2ff",
              link: "/projects",
            },
            {
              label: "Mis Tareas",
              value: summary?.totalTasks ?? 0,
              icon: "📋",
              color: "#0891b2",
              bg: "#ecfeff",
              link: "/tasks",
            },
            {
              label: "Pendientes",
              value: pendingCount,
              icon: "⏳",
              color: "#d97706",
              bg: "#fefce8",
              link: "/tasks",
            },
            {
              label: "Vencidas",
              value: realtimeOverdueCount,
              icon: "🚨",
              color: "#dc2626",
              bg: "#fef2f2",
              link: "/tasks",
            },
          ].map((kpi, i) => (
            <Link key={i} to={kpi.link} style={{ textDecoration: "none" }}>
              <div
                style={{
                  background: "var(--bg-card)",
                  borderRadius: "14px",
                  padding: "1.35rem 1.5rem",
                  border: "1px solid var(--border-color)",
                  boxShadow: "var(--shadow-card)",
                  display: "flex",
                  alignItems: "center",
                  gap: "1rem",
                  transition: "transform 0.15s ease, box-shadow 0.15s ease",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.transform =
                    "translateY(-2px)";
                  (e.currentTarget as HTMLDivElement).style.boxShadow =
                    "0 4px 12px rgba(0,0,0,0.1)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.transform =
                    "translateY(0)";
                  (e.currentTarget as HTMLDivElement).style.boxShadow =
                    "0 1px 3px rgba(0,0,0,0.06)";
                }}
              >
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "12px",
                    background: kpi.bg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "1.3rem",
                    flexShrink: 0,
                  }}
                >
                  {kpi.icon}
                </div>
                <div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "0.78rem",
                      color: "var(--text-muted)",
                      fontWeight: 500,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                    }}
                  >
                    {kpi.label}
                  </p>
                  <p
                    style={{
                      margin: "0.1rem 0 0",
                      fontSize: "1.9rem",
                      fontWeight: 800,
                      color:
                        i === 3 && kpi.value > 0
                          ? "#dc2626"
                          : "var(--text-primary)",
                      lineHeight: 1,
                    }}
                  >
                    {kpi.value}
                    {i === 3 && kpi.value > 0 && (
                      <span
                        style={{
                          display: "inline-block",
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          background: "#ef4444",
                          marginLeft: "0.4rem",
                          marginBottom: "0.3rem",
                          animation: "blink 1.5s ease-in-out infinite",
                        }}
                      />
                    )}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* ── Main Grid ── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 380px",
            gap: "1.25rem",
            alignItems: "start",
          }}
        >
          {/* ── Columna Izquierda ── */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "1.25rem",
              minWidth: 0,
            }}
          >
            {/* Proyectos Activos */}
            <Panel>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "1.25rem",
                }}
              >
                <SectionTitle>📁 Proyectos activos</SectionTitle>
                <Link
                  to="/projects"
                  style={{
                    fontSize: "0.8rem",
                    color: "#6366f1",
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  Ver todos →
                </Link>
              </div>
              {(data?.activeProjects?.length ?? 0) === 0 && (
                <div
                  style={{
                    textAlign: "center",
                    padding: "1.5rem 0",
                    color: "#94a3b8",
                    fontSize: "0.85rem",
                  }}
                >
                  📭 No tienes proyectos activos
                </div>
              )}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.6rem",
                }}
              >
                {data?.activeProjects?.map((project: Project) => {
                  const progress = getProgress(project);
                  const pc = getProgressColor(progress);
                  return (
                    <Link
                      to={`/projects/${project.id}`}
                      key={project.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "1rem",
                        padding: "0.85rem 1rem",
                        borderRadius: "10px",
                        background: "var(--bg-subtle)",
                        border: "1px solid var(--border-color)",
                        textDecoration: "none",
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background =
                          "rgba(99,102,241,0.08)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = "var(--bg-subtle)")
                      }
                    >
                      <div
                        style={{
                          width: "36px",
                          height: "36px",
                          borderRadius: "8px",
                          background: `${pc}18`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "1rem",
                          flexShrink: 0,
                        }}
                      >
                        📁
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p
                          style={{
                            margin: "0 0 0.35rem",
                            fontSize: "0.88rem",
                            fontWeight: 600,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            color: "var(--text-primary)",
                          }}
                        >
                          {project.name}
                        </p>
                        <div
                          style={{
                            height: "5px",
                            background: "var(--border-color)",
                            borderRadius: "999px",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              width: `${progress}%`,
                              background: pc,
                              borderRadius: "999px",
                              transition: "width 0.4s ease",
                            }}
                          />
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: "0.8rem",
                          fontWeight: 700,
                          color: pc,
                          flexShrink: 0,
                          minWidth: "36px",
                          textAlign: "right",
                        }}
                      >
                        {progress}%
                      </span>
                    </Link>
                  );
                })}
              </div>
            </Panel>

            {/* Tareas Vencidas */}
            {allOverdueTasks.length > 0 && (
              <Panel style={{ borderLeft: "4px solid #ef4444" }}>
                <SectionTitle>🔴 Tareas vencidas</SectionTitle>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.6rem",
                  }}
                >
                  {allOverdueTasks.map((task) => {
                    const mins = getMinutesLeft(task.dueDate!);
                    const isJust = mins > -60 && mins < 0;
                    return (
                      <div
                        key={task.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.85rem",
                          padding: "0.7rem 1rem",
                          borderRadius: "8px",
                          background: isJust ? "#fff5f5" : "var(--bg-subtle)",
                          border: `1px solid ${isJust ? "#fecaca" : "var(--border-color)"}`,
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p
                            style={{
                              margin: 0,
                              fontSize: "0.87rem",
                              fontWeight: 500,
                              color: "var(--text-primary)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {task.title}
                            {isJust && (
                              <span
                                style={{
                                  marginLeft: "0.5rem",
                                  fontSize: "0.65rem",
                                  background: "#ef4444",
                                  color: "#fff",
                                  padding: "0.1rem 0.45rem",
                                  borderRadius: "999px",
                                }}
                              >
                                Recién vencida
                              </span>
                            )}
                          </p>
                       <p
  style={{
    margin: "0.15rem 0 0",
    fontSize: "0.75rem",
    color: "#ef4444",
    fontWeight: 500,
  }}
>
  {(() => {
    const absMins = Math.abs(mins);

    if (absMins < 60) {
      return `Venció hace ${absMins} min`;
    }

    const hours = Math.floor(absMins / 60);
    if (hours < 24) {
      return `Venció hace ${hours}h`;
    }

    const days = Math.floor(hours / 24);
    return `Venció hace ${days}d`;
  })()}
  {task.dueDate && ` · ${formatTime(task.dueDate)}`}
</p>
                        </div>
                        <span
                          style={{
                            fontSize: "0.7rem",
                            color: "#fff",
                            background:
                              priorityColor[task.priority] ?? "#6b7280",
                            padding: "0.15rem 0.55rem",
                            borderRadius: "999px",
                            fontWeight: 600,
                            flexShrink: 0,
                          }}
                        >
                          {task.priority === "HIGH"
                            ? "Alta"
                            : task.priority === "MEDIUM"
                              ? "Media"
                              : "Baja"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </Panel>
            )}

            {/* Actividad Reciente */}
            <Panel>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "0.5rem",
                }}
              >
                <SectionTitle>🕐 Actividad reciente</SectionTitle>
                {(data?.recentActivity?.length ?? 0) > 0 && (
                  <span
                    style={{
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      background: "#6366f1",
                      color: "#fff",
                      padding: "0.15rem 0.6rem",
                      borderRadius: "999px",
                    }}
                  >
                    {data!.recentActivity.length}
                  </span>
                )}
              </div>
              <RecentActivity items={data?.recentActivity ?? []} />
            </Panel>
          </div>

          {/* ── Columna Derecha ── */}
          <div
            style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}
          >
            {/* Gráfico Dona */}
            <Panel>
              <SectionTitle>📊 Estado general</SectionTitle>
              <DonutChart
                pending={pendingCount}
                inProgress={inProgressCount}
                completed={completedCount}
                overdue={realtimeOverdueCount}
              />
            </Panel>

            {/* ✅ Próximas a Vencer — FIX de fecha */}
            <Panel>
              <SectionTitle>⏰ Próximas a vencer</SectionTitle>
              {(data?.upcomingTasks?.length ?? 0) === 0 && (
                <div
                  style={{
                    textAlign: "center",
                    padding: "1.25rem 0",
                    color: "var(--text-muted)",
                    fontSize: "0.83rem",
                  }}
                >
                  ✅ Sin tareas próximas a vencer
                </div>
              )}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.55rem",
                }}
              >
                {data?.upcomingTasks?.map((task) => {
                  const dueDate = task.dueDate;
                  if (!dueDate) return null;

                  // ✅ FIX: getDayLabel compara calendarios, no Math.ceil de horas
                  const dayInfo = getDayLabel(dueDate, now);

                  return (
                    <div
                      key={task.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.75rem",
                        padding: "0.7rem 0.85rem",
                        borderRadius: "8px",
                        background: "var(--bg-subtle)",
                        border: "1px solid var(--border-color)",
                        opacity: dayInfo.expired ? 0.6 : 1,
                        borderLeft: `3px solid ${dayInfo.color}`,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p
                          style={{
                            margin: 0,
                            fontSize: "0.85rem",
                            fontWeight: 500,
                            color: "var(--text-primary)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {task.title}
                        </p>
                        <p
                          style={{
                            margin: "0.15rem 0 0",
                            fontSize: "0.73rem",
                            color: "var(--text-muted)",
                          }}
                        >
                          {task.project?.name ??
                            task.project?.name ??
                            "Sin proyecto"}
                          {" · "}
                          {formatTime(dueDate)}
                        </p>
                      </div>
                      <span
                        style={{
                          fontSize: "0.72rem",
                          color: "#fff",
                          background: dayInfo.color,
                          padding: "0.2rem 0.55rem",
                          borderRadius: "999px",
                          fontWeight: 700,
                          whiteSpace: "nowrap",
                          flexShrink: 0,
                        }}
                      >
                        {dayInfo.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Panel>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.3; transform: scale(1.5); }
        }
        @media (max-width: 1024px) {
          .dashboard-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
};

export default Dashboard;
