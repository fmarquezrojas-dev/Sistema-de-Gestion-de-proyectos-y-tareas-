import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import type { Task } from "../types";

const priorityColor: Record<string, string> = {
  HIGH: "#ef4444",
  MEDIUM: "#f59e0b",
  LOW: "#22c55e",
};
const priorityLabel: Record<string, string> = {
  HIGH: "Alta",
  MEDIUM: "Media",
  LOW: "Baja",
};
const statusLabel: Record<string, string> = {
  PENDING: "Pendiente",
  IN_PROGRESS: "En progreso",
  COMPLETED: "Completada",
};
const statusColor: Record<string, string> = {
  PENDING: "#fef9c3",
  IN_PROGRESS: "#dbeafe",
  COMPLETED: "#dcfce7",
};
const statusTextColor: Record<string, string> = {
  PENDING: "#854d0e",
  IN_PROGRESS: "#1d4ed8",
  COMPLETED: "#16a34a",
};

const getDaysLeft = (dueDate: string) => {
  const diff = new Date(dueDate).getTime() - new Date().getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

const Tasks = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterPriority, setFilterPriority] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const res = await api.get("/tasks/my-tasks");
      setTasks(res.data.data);
    } catch {
      alert("Error al cargar tareas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const handleStatusChange = async (taskId: number, status: string) => {
    try {
      await api.put(`/tasks/${taskId}`, { status });
      fetchTasks();
    } catch {
      alert("Error al actualizar tarea");
    }
  };

  const filteredTasks = tasks.filter((task) => {
    if (filterPriority && task.priority !== filterPriority) return false;
    if (filterStatus && task.status !== filterStatus) return false;
    return true;
  });

  const pendingCount = tasks.filter((t) => t.status === "PENDING").length;
  const inProgressCount = tasks.filter(
    (t) => t.status === "IN_PROGRESS",
  ).length;
  const completedCount = tasks.filter((t) => t.status === "COMPLETED").length;
  const overdueCount = tasks.filter(
    (t) => t.dueDate && getDaysLeft(t.dueDate) < 0 && t.status !== "COMPLETED",
  ).length;

  return (
    <div style={styles.container}>
      <nav style={styles.navbar}>
        <h2 style={styles.logo}>🚀 ProjectManager</h2>
        <div style={styles.navLinks}>
          <Link to="/dashboard" style={styles.navLink}>
            Dashboard
          </Link>
          <Link to="/projects" style={styles.navLink}>
            Proyectos
          </Link>
          <Link to="/tasks" style={styles.navLink}>
            Mis Tareas
          </Link>
              <Link to="/profile" style={styles.navLink}>Mi Perfil</Link>

          <button onClick={handleLogout} style={styles.logoutBtn}>
            Salir
          </button>
        </div>
      </nav>

      <div style={styles.content}>
        <h1 style={styles.title}>📋 Mis Tareas</h1>

        {/* Summary cards */}
        <div style={styles.cards}>
          <div style={{ ...styles.card, borderTop: "4px solid #f59e0b" }}>
            <p style={styles.cardLabel}>Pendientes</p>
            <p style={styles.cardValue}>{pendingCount}</p>
          </div>
          <div style={{ ...styles.card, borderTop: "4px solid #4f46e5" }}>
            <p style={styles.cardLabel}>En Progreso</p>
            <p style={styles.cardValue}>{inProgressCount}</p>
          </div>
          <div style={{ ...styles.card, borderTop: "4px solid #22c55e" }}>
            <p style={styles.cardLabel}>Completadas</p>
            <p style={styles.cardValue}>{completedCount}</p>
          </div>
          <div style={{ ...styles.card, borderTop: "4px solid #ef4444" }}>
            <p style={styles.cardLabel}>Vencidas</p>
            <p
              style={{
                ...styles.cardValue,
                color: overdueCount > 0 ? "#ef4444" : "#1a1a2e",
              }}
            >
              {overdueCount}
            </p>
          </div>
        </div>

        {/* Filtros */}
        <div style={styles.filters}>
          <select
            style={styles.select}
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">Todos los estados</option>
            <option value="PENDING">Pendientes</option>
            <option value="IN_PROGRESS">En progreso</option>
            <option value="COMPLETED">Completadas</option>
          </select>
          <select
            style={styles.select}
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
          >
            <option value="">Todas las prioridades</option>
            <option value="HIGH">Alta</option>
            <option value="MEDIUM">Media</option>
            <option value="LOW">Baja</option>
          </select>
          {(filterStatus || filterPriority) && (
            <button
              style={styles.clearBtn}
              onClick={() => {
                setFilterStatus("");
                setFilterPriority("");
              }}
            >
              Limpiar filtros ✕
            </button>
          )}
          <span style={styles.resultCount}>
            {filteredTasks.length} tarea(s)
          </span>
        </div>

        {/* Lista de tareas */}
        {loading && <p style={styles.empty}>Cargando tareas...</p>}

        {!loading && filteredTasks.length === 0 && (
          <div style={styles.emptyState}>
            <p style={{ fontSize: "3rem" }}>✅</p>
            <p style={{ fontWeight: 600, color: "#1a1a2e" }}>
              No tienes tareas asignadas
            </p>
            <p style={{ color: "#888", fontSize: "0.9rem" }}>
              Las tareas que te asignen aparecerán aquí
            </p>
          </div>
        )}

        {filteredTasks.map((task) => {
          const daysLeft = task.dueDate ? getDaysLeft(task.dueDate) : null;
          const isOverdue =
            daysLeft !== null && daysLeft < 0 && task.status !== "COMPLETED";

          return (
            <div
              key={task.id}
              style={{
                ...styles.taskCard,
                borderLeft: `4px solid ${priorityColor[task.priority]}`,
                opacity: task.status === "COMPLETED" ? 0.7 : 1,
              }}
            >
              <div style={styles.taskMain}>
                <div style={{ flex: 1 }}>
                  <div style={styles.taskHeader}>
                    <p
                      style={{
                        ...styles.taskTitle,
                        textDecoration:
                          task.status === "COMPLETED" ? "line-through" : "none",
                      }}
                    >
                      {task.title}
                    </p>
                    <span
                      style={{
                        ...styles.priorityBadge,
                        background: priorityColor[task.priority],
                      }}
                    >
                      {priorityLabel[task.priority]}
                    </span>
                  </div>

                  {task.description && (
                    <p style={styles.taskDesc}>{task.description}</p>
                  )}

                  <div style={styles.taskMeta}>
                    {(task as any).project && (
                      <Link
                        to={`/projects/${(task as any).project.id}`}
                        style={styles.projectLink}
                      >
                        📁 {(task as any).project.name}
                      </Link>
                    )}
                    {task.dueDate && (
                      <span
                        style={{
                          ...styles.dueDate,
                          color: isOverdue
                            ? "#ef4444"
                            : daysLeft === 0
                              ? "#f59e0b"
                              : "#888",
                        }}
                      >
                        📅{" "}
                        {isOverdue
                          ? `Venció hace ${Math.abs(daysLeft!)}d`
                          : daysLeft === 0
                            ? "Vence hoy"
                            : daysLeft === 1
                              ? "Vence mañana"
                              : `Vence en ${daysLeft}d`}
                      </span>
                    )}
                  </div>
                </div>

                <select
                  style={{
                    ...styles.statusSelect,
                    background: statusColor[task.status],
                    color: statusTextColor[task.status],
                  }}
                  value={task.status}
                  onChange={(e) => handleStatusChange(task.id, e.target.value)}
                >
                  {/* ✅ Ahora usamos statusLabel para las etiquetas visibles */}
                  <option value="PENDING">{statusLabel.PENDING}</option>
                  <option value="IN_PROGRESS">{statusLabel.IN_PROGRESS}</option>
                  <option value="COMPLETED">{statusLabel.COMPLETED}</option>
                </select>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: { minHeight: "100vh", background: "#f0f2f5" },
  navbar: {
    background: "#1a1a2e",
    padding: "1rem 2rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  logo: { color: "#fff", fontSize: "1.2rem" },
  navLinks: { display: "flex", alignItems: "center", gap: "1.5rem" },
  navLink: { color: "#ccc", fontSize: "0.9rem" },
  logoutBtn: {
    background: "#ef4444",
    color: "#fff",
    border: "none",
    padding: "0.4rem 1rem",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "0.9rem",
  },
  content: { padding: "2rem", maxWidth: "900px", margin: "0 auto" },
  title: {
    fontSize: "1.6rem",
    fontWeight: 700,
    color: "#1a1a2e",
    marginBottom: "1.5rem",
  },
  cards: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "1rem",
    marginBottom: "1.5rem",
  },
  card: {
    background: "#fff",
    padding: "1rem",
    borderRadius: "8px",
    boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
  },
  cardLabel: { fontSize: "0.82rem", color: "#666", marginBottom: "0.4rem" },
  cardValue: { fontSize: "1.8rem", fontWeight: 700, color: "#1a1a2e" },
  filters: {
    display: "flex",
    gap: "0.75rem",
    alignItems: "center",
    marginBottom: "1.25rem",
    flexWrap: "wrap",
  },
  select: {
    padding: "0.5rem 0.75rem",
    border: "1px solid #ddd",
    borderRadius: "6px",
    fontSize: "0.85rem",
    background: "#fff",
    cursor: "pointer",
  },
  clearBtn: {
    background: "#fee2e2",
    color: "#ef4444",
    border: "none",
    padding: "0.5rem 0.75rem",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "0.85rem",
  },
  resultCount: { fontSize: "0.85rem", color: "#888", marginLeft: "auto" },
  taskCard: {
    background: "#fff",
    padding: "1rem 1.25rem",
    borderRadius: "8px",
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
    marginBottom: "0.75rem",
  },
  taskMain: { display: "flex", alignItems: "center", gap: "1rem" },
  taskHeader: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    marginBottom: "0.3rem",
  },
  taskTitle: { fontWeight: 500, fontSize: "0.95rem", color: "#1a1a2e" },
  taskDesc: { fontSize: "0.83rem", color: "#666", marginBottom: "0.5rem" },
  taskMeta: { display: "flex", gap: "1rem", alignItems: "center" },
  projectLink: { fontSize: "0.8rem", color: "#4f46e5", textDecoration: "none" },
  dueDate: { fontSize: "0.8rem" },
  priorityBadge: {
    fontSize: "0.7rem",
    color: "#fff",
    padding: "0.15rem 0.55rem",
    borderRadius: "999px",
    whiteSpace: "nowrap",
  },
  statusSelect: {
    border: "none",
    borderRadius: "999px",
    padding: "0.3rem 0.75rem",
    fontSize: "0.78rem",
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
    flexShrink: 0,
  },
  empty: { color: "#999", textAlign: "center", padding: "2rem" },
  emptyState: {
    textAlign: "center",
    padding: "3rem",
    background: "#fff",
    borderRadius: "8px",
    boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
  },
};

export default Tasks;
