import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { dashboardService } from "../services/api";

// --- Interfaces ---
interface Task {
  id: number;
  title: string;
  priority: string;
  status: string;
  dueDate?: string;
  project: { id: number; name: string };
  assignee?: { name: string };
}

interface Project {
  id: number;
  name: string;
  status: string;
  _count: { tasks: number };
  tasks: { status: string }[];
}

interface DashboardData {
  summary: {
    totalProjects: number;
    totalTasks: number;
    completedTasks: number;
    pendingTasks: number;
    overdueTasks: number;
  };
  activeProjects: Project[];
  myPendingTasks: Task[];
  overdueTasks: Task[];
  upcomingTasks: any[];
  recentActivity: Task[];
}

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

const getProgress = (project: Project) => {
  const total = project.tasks?.length || 0;
  if (total === 0) return 0;
  const completed = project.tasks.filter(
    (t) => t.status === "COMPLETED",
  ).length;
  return Math.round((completed / total) * 100);
};

const getDaysLeft = (dueDate: string) => {
  const diff = new Date(dueDate).getTime() - new Date().getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
  try {
    setLoading(true)
    const result = await dashboardService.getStats()
    
    // Si el backend envía { data: {...} }, extraemos result.data
    // Si usas Axios, la respuesta ya viene en result.data, 
    // por lo que podrías necesitar result.data.data
    const cleanData = result.data ? result.data : result;
    
    setData(cleanData)
    setError(null)
  } catch (err: any) {
    setError(err.response?.data?.message || 'Error al cargar datos')
  } finally {
    setLoading(false)
  }
}, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  // 1. PRIMER FILTRO: Cargando
  if (loading) return <div style={styles.center}>Cargando dashboard...</div>;

  // 2. SEGUNDO FILTRO: Error
  if (error)
    return (
      <div style={styles.center}>
        <div style={{ textAlign: "center" }}>
          <p style={{ color: "#ef4444" }}>{error}</p>
          <button
            onClick={() => window.location.reload()}
            style={styles.logoutBtn}
          >
            Reintentar
          </button>
        </div>
      </div>
    );

  // 3. TERCER FILTRO: Si data sigue siendo null por alguna razón extraña
  if (!data || !data.summary)
    return (
      <div style={styles.center}>No se encontraron datos disponibles.</div>
    );

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
        <h1 style={styles.title}>Hola, {user?.name} 👋</h1>

        {/* Alerta - Uso de Optional Chaining estricto */}
        {data.summary.overdueTasks > 0 && (
          <div style={styles.alert}>
            ⚠️ Tienes <strong>{data.summary.overdueTasks}</strong> tarea(s)
            vencida(s)
          </div>
        )}

        <div style={styles.cards}>
          <div style={{ ...styles.card, borderTop: "4px solid #4f46e5" }}>
            <p style={styles.cardLabel}>Total Proyectos</p>
            <p style={styles.cardValue}>{data.summary.totalProjects ?? 0}</p>
          </div>
          <div style={{ ...styles.card, borderTop: "4px solid #22c55e" }}>
            <p style={styles.cardLabel}>Total Tareas</p>
            <p style={styles.cardValue}>{data.summary.totalTasks ?? 0}</p>
          </div>
          <div style={{ ...styles.card, borderTop: "4px solid #f59e0b" }}>
            <p style={styles.cardLabel}>Pendientes</p>
            <p style={styles.cardValue}>{data.summary.pendingTasks ?? 0}</p>
          </div>
          <div style={{ ...styles.card, borderTop: "4px solid #ef4444" }}>
            <p style={styles.cardLabel}>Vencidas</p>
            <p
              style={{
                ...styles.cardValue,
                color: data.summary.overdueTasks ? "#ef4444" : "#1a1a2e",
              }}
            >
              {data.summary.overdueTasks ?? 0}
            </p>
          </div>
        </div>

        <div style={styles.grid}>
          {/* Proyectos */}
          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <h2 style={styles.sectionTitle}>📁 Proyectos Activos</h2>
              <Link to="/projects" style={styles.seeAll}>
                Ver todos →
              </Link>
            </div>
            {data.activeProjects?.length === 0 && (
              <p style={styles.empty}>Sin proyectos activos</p>
            )}
            {data.activeProjects?.map((project) => {
              const progress = getProgress(project);
              return (
                <Link
                  to={`/projects/${project.id}`}
                  key={project.id}
                  style={styles.projectItem}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: "0.4rem",
                    }}
                  >
                    <p style={styles.itemTitle}>{project.name}</p>
                    <span style={styles.progressLabel}>{progress}%</span>
                  </div>
                  <div style={styles.progressBar}>
                    <div
                      style={{
                        ...styles.progressFill,
                        width: `${progress}%`,
                        background: progress === 100 ? "#22c55e" : "#4f46e5",
                      }}
                    />
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Tareas Vencidas */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>🔴 Tareas Vencidas</h2>
            {data.overdueTasks?.length === 0 && (
              <p style={styles.empty}>¡Todo al día! 🎉</p>
            )}
            {data.overdueTasks?.map((task) => {
              const days = task.dueDate
                ? Math.abs(getDaysLeft(task.dueDate))
                : 0;
              return (
                <div
                  key={task.id}
                  style={{ ...styles.item, borderLeft: "4px solid #ef4444" }}
                >
                  <div>
                    <p style={styles.itemTitle}>{task.title}</p>
                    <p style={styles.itemSub}>
                      {task.project?.name} • Venció hace {days}d
                    </p>
                  </div>
                  <span
                    style={{
                      ...styles.priorityBadge,
                      background: priorityColor[task.priority],
                    }}
                  >
                    {priorityLabel[task.priority]}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Próximas a Vencer */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>⏰ Próximas a Vencer</h2>
            {data.upcomingTasks?.length === 0 && (
              <p style={styles.empty}>No hay tareas próximas</p>
            )}
            {data.upcomingTasks?.map((task: any) => {
              const days = task.dueDate ? getDaysLeft(task.dueDate) : null;
              return (
                <div key={task.id} style={styles.item}>
                  <div>
                    <p style={styles.itemTitle}>{task.title}</p>
                    <p style={styles.itemSub}>
                      {task.project?.name || task.project_name} •
                      <span
                        style={{
                          color:
                            days !== null && days <= 2 ? "#ef4444" : "#666",
                        }}
                      >
                        {days === 0 ? " Vence hoy" : ` Faltan ${days}d`}
                      </span>
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>📋 Actividad Reciente</h2>
            {data.recentActivity?.length === 0 && (
              <p style={styles.empty}>Sin actividad</p>
            )}
            {data.recentActivity?.map((task) => (
              <div key={task.id} style={styles.activityItem}>
                <div style={{ flex: 1 }}>
                  <p style={styles.itemTitle}>{task.title}</p>
                  <p style={styles.itemSub}>{statusLabel[task.status]}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// Estilos (Asegúrate de que 'navLink' tenga 'textDecoration: none')
const styles: Record<string, React.CSSProperties> = {
  container: { minHeight: "100vh", background: "#f0f2f5" },
  center: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100vh",
    color: "#666",
  },
  navbar: {
    background: "#1a1a2e",
    padding: "1rem 2rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  logo: { color: "#fff", fontSize: "1.2rem" },
  navLinks: { display: "flex", alignItems: "center", gap: "1.5rem" },
  navLink: { color: "#ccc", fontSize: "0.9rem", textDecoration: "none" },
  logoutBtn: {
    background: "#ef4444",
    color: "#fff",
    border: "none",
    padding: "0.4rem 1rem",
    borderRadius: "4px",
    cursor: "pointer",
  },
  content: { padding: "2rem", maxWidth: "1100px", margin: "0 auto" },
  title: { fontSize: "1.6rem", fontWeight: 700, marginBottom: "1rem" },
  alert: {
    background: "#fef3c7",
    color: "#92400e",
    padding: "1rem",
    borderRadius: "8px",
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
    padding: "1.25rem",
    borderRadius: "8px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
  },
  cardLabel: { fontSize: "0.85rem", color: "#666" },
  cardValue: { fontSize: "1.8rem", fontWeight: 700 },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" },
  section: {
    background: "#fff",
    borderRadius: "8px",
    padding: "1.25rem",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "1rem",
  },
  sectionTitle: { fontSize: "1rem", fontWeight: 600 },
  seeAll: { fontSize: "0.85rem", color: "#4f46e5", textDecoration: "none" },
  projectItem: {
    display: "block",
    padding: "0.8rem",
    background: "#f9f9f9",
    borderRadius: "6px",
    textDecoration: "none",
    color: "#333",
    marginBottom: "0.5rem",
  },
  progressBar: {
    height: "6px",
    background: "#eee",
    borderRadius: "10px",
    overflow: "hidden",
  },
  progressFill: { height: "100%", transition: "width 0.3s" },
  progressLabel: { fontSize: "0.75rem", fontWeight: 700, color: "#4f46e5" },
  item: {
    display: "flex",
    justifyContent: "space-between",
    padding: "0.8rem",
    background: "#f9f9f9",
    borderRadius: "6px",
    marginBottom: "0.5rem",
  },
  itemTitle: { fontSize: "0.9rem", fontWeight: 500 },
  itemSub: { fontSize: "0.75rem", color: "#888" },
  priorityBadge: {
    fontSize: "0.7rem",
    color: "#fff",
    padding: "0.2rem 0.5rem",
    borderRadius: "10px",
  },
  activityItem: { padding: "0.5rem 0", borderBottom: "1px solid #eee" },
  empty: { textAlign: "center", color: "#999", padding: "1rem" },
};

export default Dashboard;
