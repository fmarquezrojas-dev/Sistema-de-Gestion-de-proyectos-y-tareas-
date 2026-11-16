import { errorMessage } from "../services/errors";
import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/authState";
import { useApi } from "../hooks/useApi";
import Navbar from "../components/Navbar";
import api from "../services/api";
import type { Project } from "../types";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const STATUS_COLOR: Record<string, string> = {
  ACTIVE: "#22c55e", PAUSED: "#f59e0b", COMPLETED: "#6b7280",
};
const STATUS_BG: Record<string, string> = {
  ACTIVE: "#dcfce7", PAUSED: "#fef3c7", COMPLETED: "#f1f5f9",
};
const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Activo", PAUSED: "Pausado", COMPLETED: "Completado",
};
const STATUS_ICON: Record<string, string> = {
  ACTIVE: "🟢", PAUSED: "🟡", COMPLETED: "⚫",
};

const getProgressColor = (pct: number) =>
  pct < 20 ? "#ef4444" : pct < 70 ? "#f59e0b" : "#22c55e";

const timeAgo = (date: string) => {
  const diff  = Date.now() - new Date(date).getTime();
  const days  = Math.floor(diff / 86_400_000);
  if (days === 0) return "Hoy";
  if (days === 1) return "Ayer";
  if (days < 30)  return `Hace ${days}d`;
  const months = Math.floor(days / 30);
  return `Hace ${months} mes${months > 1 ? "es" : ""}`;
};

// ─── Modal de creación de proyecto ───────────────────────────────────────────
const CreateModal = ({ onClose, onCreate }: {
  onClose: () => void;
  onCreate: () => void;
}) => {
  const [form,     setForm]     = useState({ name: "", description: "" });
  const [creating, setCreating] = useState(false);
  const [error,    setError]    = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError("");
    try {
      await api.post("/projects", form);
      onCreate();
      onClose();
    } catch (err) {
      setError(errorMessage(err, "Error al crear proyecto"));
    } finally {
      setCreating(false);
    }
  };

  // Cierra con Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
      zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center",
      padding: "1rem", backdropFilter: "blur(2px)",
    }} onClick={onClose}>
      <div style={{
        background: "var(--bg-card)", borderRadius: "16px", padding: "2rem",
        maxWidth: "500px", width: "100%",
        boxShadow: "var(--shadow-modal)",
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <div>
            <h3 style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--text-primary)", margin: "0 0 0.2rem" }}>
              📁 Nuevo Proyecto
            </h3>
            <p style={{ fontSize: "0.82rem", color: "#94a3b8", margin: 0 }}>
              Crea un proyecto y empieza a colaborar con tu equipo
            </p>
          </div>
          <button onClick={onClose} style={{ background: "var(--bg-subtle)", border: "none", cursor: "pointer",
            width: "32px", height: "32px", borderRadius: "50%", fontSize: "1rem",
            display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)" }}>
            ✕
          </button>
        </div>

        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderLeft: "4px solid #ef4444",
            borderRadius: "8px", padding: "0.75rem 1rem", marginBottom: "1.25rem",
            display: "flex", gap: "0.5rem", alignItems: "center", fontSize: "0.85rem", color: "#991b1b" }}>
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "1.1rem" }}>
            <label style={S.label}>Nombre del proyecto *</label>
            <input
              style={S.input}
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="Ej: Rediseño del sitio web"
              autoFocus
              required
            />
          </div>
          <div style={{ marginBottom: "1.5rem" }}>
            <label style={S.label}>Descripción <span style={{ color: "#94a3b8", fontWeight: 400 }}>(opcional)</span></label>
            <textarea
              style={{ ...S.input, height: "90px", resize: "vertical" }}
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="¿De qué trata este proyecto?"
            />
          </div>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button style={S.submitBtn} type="submit" disabled={creating}>
              {creating ? (
                <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ width: "14px", height: "14px", border: "2px solid rgba(255,255,255,0.4)",
                    borderTop: "2px solid #fff", borderRadius: "50%", animation: "spin 0.7s linear infinite",
                    display: "inline-block" }} />
                  Creando...
                </span>
              ) : "✅ Crear Proyecto"}
            </button>
            <button type="button" onClick={onClose}
              style={{ ...S.submitBtn, background: "var(--bg-subtle)", color: "var(--text-secondary)", boxShadow: "none" }}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Card de Proyecto ─────────────────────────────────────────────────────────
const ProjectCard = ({ project, userId, view }: {
  project: Project; userId?: number; view: "grid" | "list";
}) => {
  const tasks     = project.tasks || [];
  const total     = tasks.length;
  const completed = tasks.filter((t) => t.status === "COMPLETED").length;
  const overdue   = tasks.filter((t) =>
    t.status !== "COMPLETED" && t.dueDate && new Date(t.dueDate) < new Date()
  ).length;
  const progress  = total > 0 ? Math.round((completed / total) * 100) : 0;
  const pc        = getProgressColor(progress);

  const myMember  = project.members?.find((m) => m.userId === userId);
  const isOwner   = myMember?.role === "OWNER";

  // Avatares apilados de miembros
  const visibleMembers = (project.members || []).slice(0, 4);
  const extraMembers   = Math.max(0, (project.members?.length || 0) - 4);

  if (view === "list") {
    return (
      <Link to={`/projects/${project.id}`} style={S.listCard}
        onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(99,102,241,0.06)"; (e.currentTarget as HTMLAnchorElement).style.borderColor = "#c7d2fe"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = "var(--bg-card)"; (e.currentTarget as HTMLAnchorElement).style.borderColor = "#f1f5f9"; }}
      >
        {/* Indicador de color del estado */}
        <div style={{ width: "4px", borderRadius: "4px", background: STATUS_COLOR[project.status], flexShrink: 0, alignSelf: "stretch" }} />

        <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: "1.25rem", flexWrap: "wrap" }}>
          {/* Nombre + descripción */}
          <div style={{ flex: "2 1 200px", minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: "0.95rem", color: "var(--text-primary)" }}>{project.name}</p>
              <span style={{ fontSize: "0.68rem", fontWeight: 700, color: STATUS_COLOR[project.status],
                background: STATUS_BG[project.status], padding: "0.1rem 0.5rem", borderRadius: "999px" }}>
                {STATUS_ICON[project.status]} {STATUS_LABEL[project.status]}
              </span>
              {isOwner && (
                <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "#4f46e5", background: "#eef2ff", padding: "0.1rem 0.5rem", borderRadius: "999px" }}>
                  👑 Dueño
                </span>
              )}
            </div>
            {project.description && (
              <p style={{ margin: "0.2rem 0 0", fontSize: "0.8rem", color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {project.description}
              </p>
            )}
          </div>

          {/* Progreso */}
          <div style={{ flex: "1 1 140px", minWidth: "120px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.3rem" }}>
              <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>{completed}/{total} tareas</span>
              <span style={{ fontSize: "0.72rem", fontWeight: 700, color: pc }}>{total === 0 ? "—" : `${progress}%`}</span>
            </div>
            <div style={{ height: "5px", background: "var(--border-color)", borderRadius: "999px", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${progress}%`, background: pc, borderRadius: "999px", transition: "width 0.4s ease" }} />
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexShrink: 0 }}>
            {overdue > 0 && (
              <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#ef4444", background: "#fee2e2", padding: "0.15rem 0.55rem", borderRadius: "999px" }}>
                🔴 {overdue} vencida{overdue > 1 ? "s" : ""}
              </span>
            )}
            <span style={{ fontSize: "0.78rem", color: "#94a3b8" }}>{timeAgo(project.updatedAt || project.createdAt)}</span>
          </div>
        </div>
      </Link>
    );
  }

  // Vista GRID
  return (
    <Link to={`/projects/${project.id}`} style={S.card}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLAnchorElement;
        el.style.transform = "translateY(-3px)";
        el.style.boxShadow = "0 8px 24px rgba(0,0,0,0.1)";
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLAnchorElement;
        el.style.transform = "translateY(0)";
        el.style.boxShadow = "0 1px 4px rgba(0,0,0,0.06)";
      }}
    >
      {/* Tope de color */}
      <div style={{ height: "4px", background: `linear-gradient(90deg, ${STATUS_COLOR[project.status]}, ${pc})`, borderRadius: "14px 14px 0 0", margin: "-1.5rem -1.5rem 1.25rem" }} />

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem", marginBottom: "0.6rem" }}>
        <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)", margin: 0, lineHeight: 1.3, flex: 1 }}>
          {project.name}
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", alignItems: "flex-end", flexShrink: 0 }}>
          <span style={{ fontSize: "0.68rem", fontWeight: 700, color: STATUS_COLOR[project.status],
            background: STATUS_BG[project.status], padding: "0.2rem 0.55rem", borderRadius: "999px" }}>
            {STATUS_ICON[project.status]} {STATUS_LABEL[project.status]}
          </span>
          <span style={{ fontSize: "0.68rem", fontWeight: 700,
            color: isOwner ? "#4f46e5" : "#16a34a",
            background: isOwner ? "#eef2ff" : "#f0fdf4",
            padding: "0.15rem 0.55rem", borderRadius: "999px" }}>
            {isOwner ? "👑 Dueño" : "🤝 Miembro"}
          </span>
        </div>
      </div>

      {/* Descripción */}
      {project.description ? (
        <p style={{ fontSize: "0.84rem", color: "var(--text-secondary)", margin: "0 0 1.1rem", lineHeight: 1.55,
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", flex: 1 }}>
          {project.description}
        </p>
      ) : (
        <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", fontStyle: "italic", margin: "0 0 1.1rem", flex: 1 }}>
          Sin descripción
        </p>
      )}

      {/* Badge vencidas */}
      {overdue > 0 && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "6px",
          padding: "0.35rem 0.75rem", marginBottom: "0.85rem", fontSize: "0.78rem", color: "#ef4444", fontWeight: 600 }}>
          🔴 {overdue} tarea{overdue > 1 ? "s" : ""} vencida{overdue > 1 ? "s" : ""}
        </div>
      )}

      {/* Barra de progreso */}
      <div style={{ marginBottom: "1.1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.35rem" }}>
          <span style={{ fontSize: "0.73rem", color: "#94a3b8" }}>
            {total === 0 ? "Sin tareas aún" : `${completed} de ${total} completadas`}
          </span>
          <span style={{ fontSize: "0.73rem", fontWeight: 700, color: total === 0 ? "#cbd5e1" : pc }}>
            {total === 0 ? "—" : `${progress}%`}
          </span>
        </div>
        <div style={{ height: "6px", background: "var(--border-color)", borderRadius: "999px", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${progress}%`, background: pc,
            borderRadius: "999px", transition: "width 0.5s ease" }} />
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
        borderTop: "1px solid var(--border-light)", paddingTop: "0.85rem" }}>
        {/* Avatares apilados */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <div style={{ display: "flex" }}>
            {visibleMembers.map((m, i) => (
              <div key={m.userId} style={{
                width: "26px", height: "26px", borderRadius: "50%",
                background: m.user?.avatarColor || "#4f46e5",
                border: "2px solid var(--bg-card)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "0.65rem", fontWeight: 700, color: "#fff",
                marginLeft: i > 0 ? "-8px" : "0",
                zIndex: visibleMembers.length - i,
                position: "relative",
              }}>
                {m.user?.name?.charAt(0).toUpperCase()}
              </div>
            ))}
            {extraMembers > 0 && (
              <div style={{ width: "26px", height: "26px", borderRadius: "50%",
                background: "#e2e8f0", border: "2px solid var(--bg-card)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "0.6rem", fontWeight: 700, color: "#64748b",
                marginLeft: "-8px", position: "relative", zIndex: 0 }}>
                +{extraMembers}
              </div>
            )}
          </div>
          <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
            {project.members?.length || 0} miembro{(project.members?.length || 0) !== 1 ? "s" : ""}
          </span>
        </div>

        <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>
          🕐 {timeAgo(project.updatedAt || project.createdAt)}
        </span>
      </div>
    </Link>
  );
};

// ─── Componente Principal ─────────────────────────────────────────────────────
const Projects = () => {
  const { user } = useAuth();
  const { data: projects, loading, error, fetch } = useApi<Project[]>("/projects");

  const [showModal,    setShowModal]    = useState(false);
  const [searchText,   setSearchText]   = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterRole,   setFilterRole]   = useState(""); // "owner" | "member" | ""
  const [sortBy,       setSortBy]       = useState<"recent" | "name" | "progress">("recent");
  const [view,         setView]         = useState<"grid" | "list">("grid");

  useEffect(() => { fetch(); }, [fetch]);

  // ── Filtrado + ordenación ──────────────────────────────────────────────────
  const processed = useMemo(() => {
    let list = (projects || []);

    // Búsqueda
    if (searchText) {
      const q = searchText.toLowerCase();
      list = list.filter((p: Project) =>
        p.name.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q)
      );
    }

    // Filtro estado
    if (filterStatus) list = list.filter((p: Project) => p.status === filterStatus);

    // Filtro rol
    if (filterRole) {
      list = list.filter((p: Project) => {
        const m = p.members?.find((m) => m.userId === user?.id);
        return filterRole === "owner" ? m?.role === "OWNER" : m?.role !== "OWNER";
      });
    }

    // Ordenación
    list = [...list].sort((a, b) => {
      if (sortBy === "name")    return a.name.localeCompare(b.name);
      if (sortBy === "progress") {
        const getP = (p: Project) => {
          const tasks = p.tasks || [];
          if (!tasks.length) return -1;
          return tasks.filter((t) => t.status === "COMPLETED").length / tasks.length;
        };
        return getP(b) - getP(a);
      }
      // recent → por updatedAt o createdAt desc
      return new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime();
    });

    return list as Project[];
  }, [projects, searchText, filterStatus, filterRole, sortBy, user?.id]);

  // Contadores para tabs
  const totalOwned  = (projects || []).filter((p: Project) => p.members?.find((m) => m.userId === user?.id)?.role === "OWNER").length;
  const totalMember = (projects || []).length - totalOwned;

  const hasFilters = searchText || filterStatus || filterRole;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-app)" }}>
      {/* ── Navbar compartido ── */}
      <Navbar />

      {/* ── Modal crear proyecto ── */}
      {showModal && (
        <CreateModal onClose={() => setShowModal(false)} onCreate={() => fetch()} />
      )}

      <div style={S.content}>

        {/* ── Page Header ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.75rem", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--text-primary)", margin: "0 0 0.25rem", letterSpacing: "-0.02em" }}>
              📁 Proyectos
            </h1>
            <p style={{ color: "#64748b", fontSize: "0.88rem", margin: 0 }}>
              {(projects || []).length} proyecto{(projects || []).length !== 1 ? "s" : ""} en total ·{" "}
              <span style={{ color: "#4f46e5", fontWeight: 600 }}>{totalOwned} como dueño</span>{" "}
              · {totalMember} como miembro
            </p>
          </div>
          <button onClick={() => setShowModal(true)} style={S.createBtn}>
            + Nuevo Proyecto
          </button>
        </div>

        {/* ── Barra de filtros ── */}
        <div style={S.filterBar}>
          {/* Búsqueda */}
          <div style={{ position: "relative", flex: 1, minWidth: "180px" }}>
            <span style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", fontSize: "0.9rem", color: "#94a3b8" }}>
              🔍
            </span>
            <input
              style={S.searchInput}
              type="text"
              placeholder="Buscar proyectos..."
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
            />
          </div>

          {/* Filtro estado */}
          <select style={S.select} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">Todos los estados</option>
            <option value="ACTIVE">🟢 Activos</option>
            <option value="PAUSED">🟡 Pausados</option>
            <option value="COMPLETED">⚫ Completados</option>
          </select>

          {/* Filtro rol */}
          <select style={S.select} value={filterRole} onChange={e => setFilterRole(e.target.value)}>
            <option value="">Todos los roles</option>
            <option value="owner">👑 Dueño</option>
            <option value="member">🤝 Miembro</option>
          </select>

          {/* Ordenación */}
          <select style={S.select} value={sortBy} onChange={e => setSortBy(e.target.value as "recent" | "name" | "progress")}>
            <option value="recent">🕐 Más recientes</option>
            <option value="name">🔤 Nombre A-Z</option>
            <option value="progress">📊 Progreso</option>
          </select>

          {/* Limpiar */}
          {hasFilters && (
            <button onClick={() => { setSearchText(""); setFilterStatus(""); setFilterRole(""); }}
              style={{ background: "#fee2e2", color: "#ef4444", border: "none", padding: "0.55rem 0.85rem", borderRadius: "8px", cursor: "pointer", fontSize: "0.82rem", fontWeight: 600, whiteSpace: "nowrap" }}>
              Limpiar ✕
            </button>
          )}

          {/* Toggle vista */}
          <div style={{ display: "flex", gap: "0.25rem", background: "var(--border-color)", borderRadius: "8px", padding: "0.25rem", flexShrink: 0 }}>
            {(["grid", "list"] as const).map(v => (
              <button key={v} onClick={() => setView(v)} style={{
                background: view === v ? "#fff" : "transparent",
                border: "none", cursor: "pointer", padding: "0.35rem 0.65rem",
                borderRadius: "6px", fontSize: "0.85rem",
                boxShadow: view === v ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                transition: "all 0.15s",
              }}>
                {v === "grid" ? "⊞" : "☰"}
              </button>
            ))}
          </div>

          {/* Contador */}
          <span style={{ fontSize: "0.8rem", color: "#94a3b8", whiteSpace: "nowrap", flexShrink: 0 }}>
            {processed.length} de {(projects || []).length}
          </span>
        </div>

        {/* ── Estados ── */}
        {loading && (
          <div style={S.emptyState}>
            <div style={{ width: "36px", height: "36px", border: "3px solid var(--border-color)", borderTop: "3px solid #6366f1",
              borderRadius: "50%", margin: "0 auto 1rem", animation: "spin 0.8s linear infinite" }} />
            <p style={{ color: "var(--text-muted)" }}>Cargando proyectos...</p>
          </div>
        )}

        {!loading && error && (
          <div style={{ ...S.emptyState, background: "#fff5f5", border: "1px solid #fecaca" }}>
            <p style={{ fontSize: "2rem" }}>❌</p>
            <p style={{ color: "#dc2626", fontWeight: 600 }}>Error: {error}</p>
            <button onClick={() => fetch()} style={{ marginTop: "0.75rem", background: "#fee2e2", color: "#ef4444", border: "none", padding: "0.5rem 1rem", borderRadius: "6px", cursor: "pointer", fontWeight: 600 }}>
              Reintentar
            </button>
          </div>
        )}

        {!loading && !error && (projects || []).length === 0 && (
          <div style={S.emptyState}>
            <p style={{ fontSize: "3.5rem", margin: "0 0 0.75rem" }}>📁</p>
            <h2 style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--text-primary)", margin: "0 0 0.5rem" }}>
              Aún no tienes proyectos
            </h2>
            <p style={{ fontSize: "0.88rem", color: "var(--text-muted)", margin: "0 0 1.5rem" }}>
              Crea tu primer proyecto y empieza a gestionar tareas con tu equipo
            </p>
            <button onClick={() => setShowModal(true)} style={S.createBtn}>
              + Crear mi primer proyecto
            </button>
          </div>
        )}

        {!loading && !error && (projects || []).length > 0 && processed.length === 0 && (
          <div style={S.emptyState}>
            <p style={{ fontSize: "2.5rem" }}>🔍</p>
            <p style={{ fontWeight: 600, color: "var(--text-primary)" }}>Sin resultados</p>
            <p style={{ fontSize: "0.88rem", color: "var(--text-muted)" }}>Ningún proyecto coincide con los filtros aplicados</p>
            <button onClick={() => { setSearchText(""); setFilterStatus(""); setFilterRole(""); }}
              style={{ marginTop: "0.75rem", background: "#fee2e2", color: "#ef4444", border: "none", padding: "0.5rem 1rem", borderRadius: "6px", cursor: "pointer", fontWeight: 600 }}>
              Limpiar filtros
            </button>
          </div>
        )}

        {!loading && !error && processed.length > 0 && (
          view === "grid" ? (
            <div style={S.grid}>
              {processed.map(project => (
                <ProjectCard key={project.id} project={project} userId={user?.id} view="grid" />
              ))}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {processed.map(project => (
                <ProjectCard key={project.id} project={project} userId={user?.id} view="list" />
              ))}
            </div>
          )
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input:focus, select:focus { outline: none; border-color: #6366f1 !important; box-shadow: 0 0 0 3px rgba(99,102,241,0.1); }
      `}</style>
    </div>
  );
};

// ─── Estilos ──────────────────────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  content: {
    padding: "2rem 5%", maxWidth: "1440px", margin: "0 auto", boxSizing: "border-box",
  },
  createBtn: {
    background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
    color: "#fff", border: "none", padding: "0.65rem 1.35rem",
    borderRadius: "10px", cursor: "pointer", fontSize: "0.9rem", fontWeight: 700,
    boxShadow: "0 4px 12px rgba(79,70,229,0.25)", whiteSpace: "nowrap",
    transition: "opacity 0.15s",
  },
  filterBar: {
    display: "flex", gap: "0.65rem", alignItems: "center",
    flexWrap: "wrap", marginBottom: "1.5rem",
    background: "var(--bg-card)", padding: "0.85rem 1rem",
    borderRadius: "12px", boxShadow: "var(--shadow-card)",
    border: "1px solid var(--border-color)",
  },
  searchInput: {
    width: "100%", padding: "0.55rem 0.75rem 0.55rem 2.2rem",
    border: "1px solid var(--border-color)", borderRadius: "8px",
    fontSize: "0.87rem", boxSizing: "border-box", fontFamily: "inherit", background: "var(--bg-subtle)",
  },
  select: {
    padding: "0.55rem 0.75rem", border: "1px solid var(--border-color)", borderRadius: "8px",
    fontSize: "0.87rem", background: "var(--bg-subtle)", cursor: "pointer", fontFamily: "inherit", color: "var(--text-secondary)",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(310px, 1fr))",
    gap: "1.35rem",
  },
  card: {
    background: "var(--bg-card)", borderRadius: "14px", padding: "1.5rem",
    boxShadow: "var(--shadow-card)", textDecoration: "none",
    color: "var(--text-primary)", display: "flex", flexDirection: "column",
    border: "1px solid #f1f5f9", transition: "transform 0.18s ease, box-shadow 0.18s ease",
    overflow: "hidden",
  },
  listCard: {
    background: "var(--bg-card)", borderRadius: "10px", padding: "1rem 1.25rem",
    boxShadow: "var(--shadow-card)", textDecoration: "none",
    color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "1rem",
    border: "1px solid #f1f5f9", transition: "background 0.15s, border-color 0.15s",
    overflow: "hidden",
  },
  emptyState: {
    textAlign: "center", padding: "4rem 2rem",
    background: "var(--bg-card)", borderRadius: "14px",
    boxShadow: "var(--shadow-card)", border: "1px solid var(--border-color)",
  },
  label: { display: "block", marginBottom: "0.4rem", fontWeight: 600, fontSize: "0.85rem", color: "var(--text-primary)" },
  input: {
    width: "100%", padding: "0.7rem 0.9rem",
    border: "1px solid var(--border-color)", borderRadius: "8px",
    fontSize: "0.92rem", boxSizing: "border-box", fontFamily: "inherit", background: "var(--bg-subtle)",
    transition: "border-color 0.15s",
  },
  submitBtn: {
    background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
    color: "#fff", border: "none", padding: "0.7rem 1.35rem",
    borderRadius: "8px", cursor: "pointer", fontSize: "0.92rem", fontWeight: 700,
    boxShadow: "0 4px 12px rgba(79,70,229,0.25)",
  },
};

export default Projects;
