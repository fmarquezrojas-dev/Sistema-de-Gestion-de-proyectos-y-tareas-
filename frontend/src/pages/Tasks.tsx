import { useEffect, useState, useRef, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import KanbanBoard from "../components/KanbanBoard";
import TaskComments from "../components/TaskComments";
import api from "../services/api";
import type { Task } from "../types";

const priorityColor: Record<string, string> = { HIGH: "#ef4444", MEDIUM: "#f59e0b", LOW: "#22c55e" };
const priorityLabel: Record<string, string> = { HIGH: "Alta", MEDIUM: "Media", LOW: "Baja" };
const statusLabel: Record<string, string> = { PENDING: "Pendiente", IN_PROGRESS: "En progreso", COMPLETED: "Completada" };
const statusColor: Record<string, string> = { PENDING: "#fef9c3", IN_PROGRESS: "#dbeafe", COMPLETED: "#dcfce7" };
const statusTextColor: Record<string, string> = { PENDING: "#854d0e", IN_PROGRESS: "#1d4ed8", COMPLETED: "#16a34a" };
const statusOrder: Record<string, number> = { PENDING: 0, IN_PROGRESS: 1, COMPLETED: 2 };

const minutesLeft = (dueDate: string, now: Date) =>
  Math.floor((new Date(dueDate).getTime() - now.getTime()) / 60_000);

const getDueDateInfo = (
  dueDate: string | null | undefined, status: string, now: Date
): { label: string; color: string; isOverdue: boolean } | null => {
  if (!dueDate) return null;
  const mins = minutesLeft(dueDate, now);
  const isOverdue = mins < 0 && status !== "COMPLETED";

  if (status === "COMPLETED") return {
    label: `Vencía: ${new Date(dueDate).toLocaleDateString("es-PE", { day: "2-digit", month: "short" })}`,
    color: "#16a34a", isOverdue: false,
  };

  if (isOverdue) {
    const absMins = Math.abs(mins);
    const absHours = Math.floor(absMins / 60);
    const absDays  = Math.floor(absHours / 24);
    let label: string;
    if (absMins < 60)   label = `Venció hace ${absMins} min`;
    else if (absHours < 24) label = `Venció hace ${absHours}h`;
    else if (absDays === 1) label = "Venció ayer";
    else                    label = `Venció hace ${absDays}d`;
    return { label, color: "#ef4444", isOverdue: true };
  }

  if (mins <= 60)   return { label: `Vence en ${mins} min`, color: "#f59e0b", isOverdue: false };
  const hours = Math.floor(mins / 60);
  if (hours < 24)   return { label: "Vence hoy",            color: "#f59e0b", isOverdue: false };
  const days = Math.floor(hours / 24);
  if (days === 1)   return { label: "Vence mañana",         color: "#f59e0b", isOverdue: false };
  if (days <= 3)    return { label: `Vence en ${days}d`,    color: "#fb923c", isOverdue: false };
  return              { label: `Vence en ${days}d`,         color: "#94a3b8", isOverdue: false };
};

const formatDueDateTime = (dateStr: string): string => {
  const d = new Date(dateStr);
  const date = d.toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
  const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0;
  if (!hasTime) return date;
  const time = d.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", hour12: true });
  return `${date} · ${time}`;
};

const Tasks = () => {
  const { user } = useAuth()

  const [tasks, setTasks]     = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const [filterPriority, setFilterPriority] = useState("");
  const [filterStatus,   setFilterStatus]   = useState("");
  const [searchText,     setSearchText]     = useState("");
  const [groupByStatus,  setGroupByStatus]  = useState(false);
  // ── Vista: lista | kanban ──────────────────────────────────────────────────
  const [view, setView] = useState<"list" | "kanban">("list");
  // ── NUEVO: controla qué task card tiene los comentarios abiertos ──────────
  const [expandedTaskId, setExpandedTaskId] = useState<number | null>(null)
  const toggleComments = (taskId: number) =>
    setExpandedTaskId(prev => prev === taskId ? null : taskId)

  const [now, setNow] = useState(() => new Date());
  const clockRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    clockRef.current = setInterval(() => setNow(new Date()), 60_000);
    return () => { if (clockRef.current) clearInterval(clockRef.current); };
  }, []);

  const fetchTasks = async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await api.get("/tasks/my-tasks");
      const raw = res.data?.data ?? res.data;
      setTasks(Array.isArray(raw) ? raw : []);
    } catch (err: any) {
      setError(err?.response?.data?.error || "Error al cargar tareas");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => { fetchTasks(); }, []);
  useEffect(() => {
    const t = setInterval(() => fetchTasks(true), 60_000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStatusChange = async (taskId: number, status: string) => {
    // Optimistic update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: status as any } : t));
    try {
      await api.put(`/tasks/${taskId}`, { status });
      fetchTasks(true);
    } catch {
      // Revert en error
      fetchTasks(true);
      throw new Error("Error al actualizar estado");
    }
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      if (filterPriority && task.priority !== filterPriority) return false;
      if (filterStatus   && task.status   !== filterStatus)   return false;
      if (searchText) {
        const q = searchText.toLowerCase();
        if (!task.title.toLowerCase().includes(q) && !(task as any).project?.name?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [tasks, filterPriority, filterStatus, searchText]);

  const pendingCount    = tasks.filter(t => t.status === "PENDING").length;
  const inProgressCount = tasks.filter(t => t.status === "IN_PROGRESS").length;
  const completedCount  = tasks.filter(t => t.status === "COMPLETED").length;
  const overdueCount    = useMemo(() =>
    tasks.filter(t => getDueDateInfo((t as any).dueDate, t.status, now)?.isOverdue ?? false).length,
  [tasks, now]);

  const groups = useMemo(() => {
    if (!groupByStatus) return null;
    const map: Record<string, Task[]> = { PENDING: [], IN_PROGRESS: [], COMPLETED: [] };
    filteredTasks.forEach(t => { if (map[t.status]) map[t.status].push(t); });
    return Object.entries(map).filter(([, t]) => t.length > 0).sort(([a], [b]) => statusOrder[a] - statusOrder[b]);
  }, [filteredTasks, groupByStatus]);

  const hasActiveFilters = filterPriority || filterStatus || searchText;

  const renderTask = (task: Task) => {
    const dueDate = (task as any).dueDate as string | undefined;
    const info    = getDueDateInfo(dueDate, task.status, now);
    const isRecent = info?.isOverdue && dueDate ? Math.abs(minutesLeft(dueDate, now)) < 60 : false;

    const isExpanded = expandedTaskId === task.id

    return (
      <div key={task.id} style={{
        ...styles.taskCard,
        borderLeft: `4px solid ${info?.isOverdue ? "#ef4444" : priorityColor[task.priority]}`,
        background: info?.isOverdue ? (isRecent ? "rgba(239, 68, 68, 0.1)" : "rgba(249, 115, 22, 0.05)") : task.status === "COMPLETED" ? "var(--bg-subtle)" : "var(--bg-card)",
        opacity: task.status === "COMPLETED" ? 0.78 : 1,
        boxShadow: isExpanded
          ? "0 4px 16px rgba(99,102,241,0.12), 0 1px 4px rgba(0,0,0,0.06)"
          : "0 1px 4px rgba(0,0,0,0.07)",
        transition: "box-shadow 0.2s",
      }}>
        <div style={styles.taskMain}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap", marginBottom: "0.3rem" }}>
              <p style={{ ...styles.taskTitle, textDecoration: task.status === "COMPLETED" ? "line-through" : "none", color: task.status === "COMPLETED" ? "#94a3b8" : "var(--text-primary)" }}>
                {task.title}
              </p>
              <span style={{ ...styles.priorityBadge, background: priorityColor[task.priority] }}>
                {priorityLabel[task.priority]}
              </span>
              {info?.isOverdue && task.status !== "COMPLETED" && (
                <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "#fff",
                  background: isRecent ? "#ef4444" : "#f97316",
                  padding: "0.15rem 0.55rem", borderRadius: "999px", whiteSpace: "nowrap",
                  animation: isRecent ? "blink 2s ease-in-out infinite" : undefined }}>
                  🔴 {info.label}
                </span>
              )}
              {!info?.isOverdue && info && info.color === "#f59e0b" && task.status !== "COMPLETED" && (
                <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "#fff", background: "#f59e0b",
                  padding: "0.15rem 0.55rem", borderRadius: "999px", whiteSpace: "nowrap" }}>
                  ⚠️ {info.label}
                </span>
              )}
            </div>
            {task.description && <p style={styles.taskDesc}>{task.description}</p>}
            <div style={styles.taskMeta}>
              {(task as any).project && (
                <Link to={`/projects/${(task as any).project.id}`} style={styles.projectLink} title="Ver proyecto">
                  📁 {(task as any).project.name}
                </Link>
              )}
              {dueDate && info && task.status !== "COMPLETED" && (
                <span style={{ fontSize: "0.78rem", color: info.color, fontWeight: info.isOverdue ? 600 : 400 }}>
                  📅 {info.label}
                  {(info.color === "#f59e0b" || info.isOverdue) && (
                    <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginLeft: "0.3rem" }}>
                      ({formatDueDateTime(dueDate)})
                    </span>
                  )}
                </span>
              )}
              {dueDate && task.status === "COMPLETED" && (
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>📅 {formatDueDateTime(dueDate)}</span>
              )}
            </div>
          </div>
          <select
            style={{ ...styles.statusSelect, background: statusColor[task.status], color: statusTextColor[task.status] }}
            value={task.status}
            onChange={e => handleStatusChange(task.id, e.target.value)}
          >
            <option value="PENDING">{statusLabel.PENDING}</option>
            <option value="IN_PROGRESS">{statusLabel.IN_PROGRESS}</option>
            <option value="COMPLETED">{statusLabel.COMPLETED}</option>
          </select>
        </div>

        {/* ── NUEVO: Separador + Toggle comentarios ── */}
        <div style={{ borderTop: "1px solid var(--border-color)", marginTop: "0.6rem", paddingTop: "0.6rem", display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={() => toggleComments(task.id)}
            title={isExpanded ? "Ocultar comentarios" : "Ver comentarios"}
            style={{
              display:      "flex",
              alignItems:   "center",
              gap:          "0.3rem",
             background:   isExpanded ? "rgba(99, 102, 241, 0.15)" : "var(--bg-subtle)",
            border:       `1px solid ${isExpanded ? "var(--color-primary)" : "var(--border-color)"}`,
              borderRadius: "6px",
              padding:      "0.25rem 0.65rem",
              cursor:       "pointer",
              fontSize:     "0.75rem",
              fontWeight:   isExpanded ? 700 : 500,
              color:        isExpanded ? "var(--color-primary)" : "var(--text-secondary)",
              transition:   "all 0.15s",
            }}
          >
            💬 {isExpanded ? "Ocultar ▲" : "Comentarios ▼"}
          </button>
        </div>

        {/* ── NUEVO: Comentarios expandibles ──
            Fetch lazy: se monta al abrir, se desmonta al cerrar. */}
        {isExpanded && (
          <TaskComments
            taskId={task.id}
            currentUser={user ? { id: user.id, name: user.name } : null}
            readOnly={false}
          />
        )}
      </div>
    );
  };

  return (
    <div style={styles.container}>
      {/* ── Navbar compartido ── */}
      <Navbar />

      <div style={styles.content}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <h1 style={styles.title}>📋 Mis Tareas</h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", margin: 0 }}>Tareas asignadas a ti en todos tus proyectos</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            {/* Toggle agrupación — solo en lista */}
            {view === "list" && (
              <button onClick={() => setGroupByStatus(g => !g)} style={{
                background: groupByStatus ? "#4f46e5" : "var(--bg-card)", color: groupByStatus ? "#fff" : "#4f46e5",
                border: "1px solid #4f46e5", padding: "0.5rem 1rem", borderRadius: "8px",
                cursor: "pointer", fontSize: "0.85rem", fontWeight: 600,
                display: "flex", alignItems: "center", gap: "0.4rem",
              }}>
                {groupByStatus ? "🗂 Agrupado" : "☰ Agrupar"}
              </button>
            )}
            {/* Toggle Lista ↔ Kanban */}
            <div style={{ display: "flex", gap: "0.25rem", background: "var(--border-color)", borderRadius: "8px", padding: "0.25rem" }}>
              {(["list", "kanban"] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  title={v === "list" ? "Vista lista" : "Vista Kanban"}
                  style={{
                    background: view === v ? "var(--bg-card)" : "transparent",
                    border: "none", cursor: "pointer",
                    padding: "0.35rem 0.9rem", borderRadius: "6px",
                    fontSize: "0.82rem", fontWeight: view === v ? 700 : 500,
                    color: view === v ? "#4f46e5" : "var(--text-secondary)",
                    boxShadow: view === v ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                    transition: "all 0.15s",
                  }}
                >
                  {v === "list" ? "☰ Lista" : "⊞ Kanban"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Cards resumen */}
        <div style={styles.cards}>
          {[
            { label: "Pendientes",  value: pendingCount,    color: "#f59e0b", icon: "⏳" },
            { label: "En Progreso", value: inProgressCount, color: "#4f46e5", icon: "🔄" },
            { label: "Completadas", value: completedCount,  color: "#22c55e", icon: "✅" },
            { label: "Vencidas",    value: overdueCount,    color: "#ef4444", icon: "🔴" },
          ].map((c, i) => (
            <div key={i} style={{ ...styles.card, borderTop: `4px solid ${c.color}` }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                <p style={styles.cardLabel}>{c.label}</p>
                <span style={{ fontSize: "1.2rem" }}>{c.icon}</span>
              </div>
              <p style={{ ...styles.cardValue, color: i === 3 && c.value > 0 ? "#ef4444" : "var(--text-primary)" }}>
                {c.value}
                {i === 3 && c.value > 0 && (
                  <span style={{ display: "inline-block", marginLeft: "0.4rem", width: "8px", height: "8px",
                    borderRadius: "50%", background: "#ef4444", animation: "blink 1.5s ease-in-out infinite" }} />
                )}
              </p>
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div style={styles.filters}>
          <div style={{ position: "relative", flex: 1, minWidth: "200px" }}>
            <span style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", fontSize: "0.9rem", color: "#94a3b8" }}>🔍</span>
            <input style={styles.searchInput} type="text" placeholder="Buscar por título o proyecto..." value={searchText} onChange={e => setSearchText(e.target.value)} />
          </div>
          <select style={styles.select} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">Todos los estados</option>
            <option value="PENDING">⏳ Pendientes</option>
            <option value="IN_PROGRESS">🔄 En progreso</option>
            <option value="COMPLETED">✅ Completadas</option>
          </select>
          <select style={styles.select} value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
            <option value="">Todas las prioridades</option>
            <option value="HIGH">🔴 Alta</option>
            <option value="MEDIUM">🟡 Media</option>
            <option value="LOW">🟢 Baja</option>
          </select>
          {hasActiveFilters && (
            <button style={styles.clearBtn} onClick={() => { setFilterStatus(""); setFilterPriority(""); setSearchText(""); }}>Limpiar ✕</button>
          )}
          <span style={styles.resultCount}>{filteredTasks.length} de {tasks.length} tarea{tasks.length !== 1 ? "s" : ""}</span>
        </div>

        {loading && (
          <div style={styles.emptyState}>
            <p style={{ fontSize: "2rem" }}>⏳</p>
            <p style={{ color: "var(--text-secondary)" }}>Cargando tus tareas...</p>
          </div>
        )}

        {!loading && error && (
          <div style={{ ...styles.emptyState, background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)" }}>
            <p style={{ fontSize: "2rem" }}>❌</p>
            <p style={{ fontWeight: 600, color: "#dc2626" }}>{error}</p>
            <button onClick={() => fetchTasks()} style={{ ...styles.clearBtn, marginTop: "0.75rem" }}>Reintentar</button>
          </div>
        )}

        {!loading && !error && tasks.length === 0 && (
          <div style={styles.emptyState}>
            <p style={{ fontSize: "3rem" }}>📭</p>
            <p style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "1.1rem" }}>No tienes tareas asignadas</p>
            <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Las tareas que te asignen en tus proyectos aparecerán aquí</p>
            <Link to="/projects" style={{ marginTop: "1rem", display: "inline-block", color: "#4f46e5", fontWeight: 600, fontSize: "0.9rem" }}>→ Ver mis proyectos</Link>
          </div>
        )}

        {!loading && !error && tasks.length > 0 && filteredTasks.length === 0 && (
          <div style={styles.emptyState}>
            <p style={{ fontSize: "2.5rem" }}>🔍</p>
            <p style={{ fontWeight: 600, color: "var(--text-primary)" }}>Sin resultados</p>
            <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Ninguna tarea coincide con los filtros</p>
            <button onClick={() => { setFilterStatus(""); setFilterPriority(""); setSearchText(""); }} style={{ ...styles.clearBtn, marginTop: "0.75rem" }}>Limpiar filtros</button>
          </div>
        )}

        {!loading && !error && filteredTasks.length > 0 && (
          <>
            {/* ── Vista Kanban ── */}
            {view === "kanban" && (
              <KanbanBoard
                tasks={filteredTasks}
                onStatusChange={handleStatusChange}
                now={now}
              />
            )}

            {/* ── Vista Lista ── */}
            {view === "list" && (
              <>
                {groupByStatus && groups
                  ? groups.map(([status, groupTasks]) => (
                <div key={status} style={{ marginBottom: "1.5rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem", paddingBottom: "0.5rem", borderBottom: "2px solid var(--border-color)" }}>
                    <span style={{ fontSize: "0.78rem", fontWeight: 700, color: statusTextColor[status], background: statusColor[status], padding: "0.2rem 0.75rem", borderRadius: "999px" }}>
                      {statusLabel[status]}
                    </span>
                    <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{groupTasks.length} tarea{groupTasks.length !== 1 ? "s" : ""}</span>
                  </div>
                  {groupTasks.map(renderTask)}
                </div>
              ))
              : filteredTasks.map(renderTask)
            }
              </>
            )}
          </>
        )}
      </div>

      <style>{`
        @keyframes blink { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(1.4); } }
      `}</style>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: { minHeight: "100vh", background: 'var(--bg-app)' },
  content: { padding: "2rem 5%", maxWidth: "1440px", margin: "0 auto", boxSizing: "border-box" },
  title:   { fontSize: "1.8rem", fontWeight: 700, color: 'var(--text-primary)', margin: "0 0 0.25rem" },
  cards: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "1.5rem" },
  card:  { background: 'var(--bg-card)', padding: "1.25rem", borderRadius: "8px", boxShadow: 'var(--shadow-card)', boxSizing: "border-box" },
  cardLabel: { fontSize: "0.82rem", color: 'var(--text-secondary)', margin: 0, fontWeight: 500 },
  cardValue: { fontSize: "2rem", fontWeight: 800, color: 'var(--text-primary)', margin: "0.2rem 0 0", display: "flex", alignItems: "center" },
  filters: { display: "flex", gap: "0.75rem", alignItems: "center", marginBottom: "1.25rem", flexWrap: "wrap", background: 'var(--bg-card)', padding: "0.85rem 1rem", borderRadius: "8px", boxShadow: 'var(--shadow-card)' },
  searchInput: { width: "100%", padding: "0.55rem 0.75rem 0.55rem 2.2rem", border: '1px solid var(--border-color)', borderRadius: "6px", fontSize: "0.88rem", outline: "none", boxSizing: "border-box", fontFamily: "inherit", color: "var(--text-primary)" },
  select: { padding: "0.55rem 0.85rem", border: '1px solid var(--border-color)', borderRadius: "6px", fontSize: "0.88rem", background: 'var(--bg-card)', cursor: "pointer", outline: "none", fontFamily: "inherit" },
  clearBtn: { background: "#fee2e2", color: "#ef4444", border: "none", padding: "0.55rem 1rem", borderRadius: "6px", cursor: "pointer", fontSize: "0.85rem", fontWeight: 600, whiteSpace: "nowrap" },
  resultCount: { fontSize: "0.82rem", color: "#94a3b8", marginLeft: "auto", whiteSpace: "nowrap" },
  taskCard: { background: 'var(--bg-card)', padding: "1.1rem 1.25rem", borderRadius: "8px", boxShadow: 'var(--shadow-card)', marginBottom: "0.75rem" },
  taskMain: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1.25rem" },
  taskTitle: { fontWeight: 600, fontSize: "0.95rem", color: 'var(--text-primary)', margin: 0 },
  taskDesc:  { fontSize: "0.84rem", color: 'var(--text-secondary)', margin: "0.2rem 0 0.4rem", lineHeight: 1.5 },
  taskMeta:  { display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" },
  projectLink: { fontSize: "0.78rem", color: "#4f46e5", textDecoration: "none", fontWeight: 600, background: "#eef2ff", padding: "0.15rem 0.55rem", borderRadius: "4px", whiteSpace: "nowrap" },
  priorityBadge: { fontSize: "0.68rem", color: "#fff", padding: "0.15rem 0.55rem", borderRadius: "999px", whiteSpace: "nowrap", fontWeight: 700 },
  statusSelect: { border: "none", borderRadius: "8px", padding: "0.45rem 0.85rem", fontSize: "0.8rem", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", fontFamily: "inherit" },
  emptyState: { textAlign: "center", padding: "3.5rem 2rem", background: 'var(--bg-card)', borderRadius: "8px", boxShadow: 'var(--shadow-card)', border: '1px solid var(--border-color)' },
};

export default Tasks;
