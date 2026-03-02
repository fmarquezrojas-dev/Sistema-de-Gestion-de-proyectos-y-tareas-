import { useEffect, useState, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Navbar from "../components/Navbar";
import api from "../services/api";
import type { Project, Task } from "../types";
import TaskComments from "../components/TaskComments";

// ─── Avatar: muestra foto subida si existe, si no la inicial con color ───────
const Avatar = ({
  name,
  avatarUrl,
  avatarColor,
  size = 36,
}: {
  name?: string;
  avatarUrl?: string | null;
  avatarColor?: string | null;
  size?: number;
}) => {
  const [imgError, setImgError] = useState(false);
  const showImg = avatarUrl && !imgError;

  const base: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: "50%",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  };

  if (showImg)
    return (
      <div style={base}>
        <img
          src={avatarUrl!}
          alt={name ?? "avatar"}
          onError={() => setImgError(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>
    );

  return (
    <div
      style={{
        ...base,
        background: avatarColor || "#4f46e5",
        color: "#fff",
        fontSize: size * 0.38,
        fontWeight: 700,
      }}
    >
      {name?.charAt(0).toUpperCase() ?? "?"}
    </div>
  );
};

// ─── Mapas ────────────────────────────────────────────────────────────────────
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
const getProgressColor = (p: number) =>
  p < 20 ? "#ef4444" : p < 70 ? "#f59e0b" : "#22c55e";

// ─── Helpers de fecha ─────────────────────────────────────────────────────────
const formatDueDateTime = (dateStr?: string | null): string => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const date = d.toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0;
  if (!hasTime) return date;
  const time = d
    .toLocaleTimeString("es-PE", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })
    .toUpperCase();
  return `${date} · ${time}`;
};

const getOverdueInfo = (
  dueDate: string | null | undefined,
  status: string,
  now: Date,
) => {
  if (!dueDate || status === "COMPLETED") return null;
  const diff = now.getTime() - new Date(dueDate).getTime();
  if (diff <= 0) return null;
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  const isCritical = hours < 24;
  if (mins < 60) return { label: `Venció hace ${mins} min`, isCritical };
  if (hours < 24) return { label: `Venció hace ${hours}h`, isCritical };
  if (days === 1) return { label: "Venció ayer", isCritical: false };
  return { label: `Venció hace ${days}d`, isCritical: false };
};

const getUpcomingWarning = (
  dueDate: string | null | undefined,
  status: string,
  now: Date,
) => {
  if (!dueDate || status === "COMPLETED") return null;
  const diff = new Date(dueDate).getTime() - now.getTime();
  if (diff <= 0) return null;
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(mins / 60);
  if (mins <= 60) return `Vence en ${mins} min`;
  if (hours < 24) return `Vence hoy`;
  return null;
};

// ─── Toast ────────────────────────────────────────────────────────────────────
const Toast = ({
  message,
  type,
  onClose,
}: {
  message: string;
  type: "success" | "error" | "warning";
  onClose: () => void;
}) => {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);
  const C = {
    success: { bg: "#f0fdf4", border: "#22c55e", icon: "✅", text: "#15803d" },
    error: { bg: "#fef2f2", border: "#ef4444", icon: "❌", text: "#dc2626" },
    warning: { bg: "#fffbeb", border: "#f59e0b", icon: "⚠️", text: "#d97706" },
  }[type];
  return (
    <div
      style={{
        position: "fixed",
        top: "1.5rem",
        right: "1.5rem",
        zIndex: 1000,
        background: C.bg,
        border: `1px solid ${C.border}`,
        borderLeft: `4px solid ${C.border}`,
        borderRadius: "8px",
        padding: "1rem 1.25rem",
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        minWidth: "280px",
        maxWidth: "400px",
      }}
    >
      <span>{C.icon}</span>
      <p
        style={{
          margin: 0,
          fontSize: "0.9rem",
          color: C.text,
          fontWeight: 500,
          flex: 1,
        }}
      >
        {message}
      </p>
      <button
        onClick={onClose}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: C.text,
          fontSize: "1rem",
          opacity: 0.6,
        }}
      >
        ✕
      </button>
    </div>
  );
};

const ConfirmModal = ({
  message,
  onConfirm,
  onCancel,
  confirmLabel = "Confirmar",
  danger = false,
}: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  danger?: boolean;
}) => (
  <div
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.5)",
      zIndex: 999,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    <div
      style={{
        background: "var(--bg-card)",
        borderRadius: "12px",
        padding: "2rem",
        maxWidth: "400px",
        width: "90%",
        boxShadow: "var(--shadow-modal)",
      }}
    >
      <p
        style={{
          fontSize: "1rem",
          color: "var(--text-primary)",
          marginBottom: "1.5rem",
          lineHeight: 1.5,
        }}
      >
        {message}
      </p>
      <div
        style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}
      >
        <button
          onClick={onCancel}
          style={{
            padding: "0.5rem 1.25rem",
            borderRadius: "6px",
            border: "1px solid var(--border-color)",
            background: "var(--bg-card)",
            cursor: "pointer",
            fontSize: "0.9rem",
            color: "var(--text-primary)",
          }}
        >
          Cancelar
        </button>
        <button
          onClick={onConfirm}
          style={{
            padding: "0.5rem 1.25rem",
            borderRadius: "6px",
            border: "none",
            background: danger ? "#ef4444" : "#4f46e5",
            color: "#fff",
            cursor: "pointer",
            fontSize: "0.9rem",
            fontWeight: 600,
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  </div>
);

const EditTaskModal = ({
  task,
  members,
  onSave,
  onClose,
  saving,
}: {
  task: any;
  members: any[];
  onSave: (taskId: number, data: any) => void;
  onClose: () => void;
  saving: boolean;
}) => {
  const existingDate = task.dueDate ? new Date(task.dueDate) : null;
  const dateStr = existingDate ? existingDate.toISOString().split("T")[0] : "";
  const hasTime = existingDate
    ? existingDate.getHours() !== 0 || existingDate.getMinutes() !== 0
    : false;
  const timeStr =
    hasTime && existingDate
      ? `${String(existingDate.getHours()).padStart(2, "0")}:${String(existingDate.getMinutes()).padStart(2, "0")}`
      : "";

  const [form, setForm] = useState({
    title: task.title || "",
    description: task.description || "",
    priority: task.priority || "MEDIUM",
    status: task.status || "PENDING",
    dueDate: dateStr,
    dueTime: timeStr,
    assigneeId: task.assigneeId ? String(task.assigneeId) : "",
  });

  const previewDate = form.dueDate
    ? new Date(`${form.dueDate}T${form.dueTime || "23:59"}:00`)
    : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let dueDateISO: string | undefined;
    if (form.dueDate)
      dueDateISO = new Date(
        `${form.dueDate}T${form.dueTime || "23:59"}:00`,
      ).toISOString();
    onSave(task.id, {
      title: form.title,
      description: form.description,
      priority: form.priority,
      status: form.status,
      dueDate: dueDateISO,
      assigneeId: form.assigneeId ? Number(form.assigneeId) : undefined,
    });
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        zIndex: 1001,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
    >
      <div
        style={{
          background: "var(--bg-card)",
          borderRadius: "12px",
          padding: "1.75rem",
          maxWidth: "580px",
          width: "100%",
          boxShadow: "var(--shadow-modal)",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1.25rem",
          }}
        >
          <h3
            style={{
              fontSize: "1rem",
              fontWeight: 700,
              color: "var(--text-primary)",
              margin: 0,
            }}
          >
            ✏️ Editar Tarea
          </h3>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: "1.1rem",
              color: "var(--text-muted)",
            }}
          >
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={S.formRow}>
            <div style={{ ...S.field, flex: 2 }}>
              <label style={S.label}>Título *</label>
              <input
                style={S.input}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
                placeholder="Título de la tarea"
              />
            </div>
            <div style={S.field}>
              <label style={S.label}>Prioridad</label>
              <select
                style={S.input}
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
              >
                <option value="LOW">🟢 Baja</option>
                <option value="MEDIUM">🟡 Media</option>
                <option value="HIGH">🔴 Alta</option>
              </select>
            </div>
          </div>
          <div style={S.formRow}>
            <div style={S.field}>
              <label style={S.label}>Estado</label>
              <select
                style={S.input}
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="PENDING">Pendiente</option>
                <option value="IN_PROGRESS">En progreso</option>
                <option value="COMPLETED">Completada</option>
              </select>
            </div>
            <div style={{ ...S.field, flex: 2 }}>
              <label style={S.label}>👤 Asignar a</label>
              <select
                style={S.input}
                value={form.assigneeId}
                onChange={(e) =>
                  setForm({ ...form, assigneeId: e.target.value })
                }
              >
                <option value="">Sin asignar</option>
                {members.map((m: any) => (
                  <option key={m.userId} value={m.userId}>
                    {m.user?.name} ({m.role === "OWNER" ? "Owner" : "Member"})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div style={S.formRow}>
            <div style={S.field}>
              <label style={S.label}>📅 Fecha límite</label>
              <input
                style={S.input}
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              />
            </div>
            <div style={S.field}>
              <label style={S.label}>
                🕐 Hora límite{" "}
                <span
                  style={{
                    fontSize: "0.7rem",
                    color: "var(--text-muted)",
                    fontWeight: 400,
                  }}
                >
                  (por defecto 23:59)
                </span>
              </label>
              <input
                style={{
                  ...S.input,
                  background: !form.dueDate
                    ? "var(--bg-subtle)"
                    : "var(--input-bg)",
                  cursor: !form.dueDate ? "not-allowed" : "default",
                }}
                type="time"
                value={form.dueTime}
                onChange={(e) => setForm({ ...form, dueTime: e.target.value })}
                disabled={!form.dueDate}
              />
            </div>
          </div>
          {previewDate && (
            <div
              style={{
                marginBottom: "0.75rem",
                padding: "0.55rem 0.85rem",
                background: "#f0f9ff",
                borderRadius: "6px",
                border: "1px solid #bae6fd",
                fontSize: "0.82rem",
                color: "#0369a1",
              }}
            >
              📌 Vencerá el{" "}
              <strong>
                {previewDate.toLocaleDateString("es-PE", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </strong>{" "}
              a las{" "}
              <strong>
                {previewDate
                  .toLocaleTimeString("es-PE", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: true,
                  })
                  .toUpperCase()}
              </strong>
            </div>
          )}
          <div style={S.field}>
            <label style={S.label}>Descripción</label>
            <textarea
              style={{ ...S.input, height: "70px", resize: "vertical" }}
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              placeholder="Descripción opcional"
            />
          </div>
          <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
            <button style={S.submitBtn} type="submit" disabled={saving}>
              {saving ? "Guardando..." : "💾 Guardar cambios"}
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{ ...S.submitBtn, background: "#6b7280" }}
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const PermissionsModal = ({
  member,
  onSave,
  onClose,
  saving,
}: {
  member: any;
  onSave: (memberId: number, perms: any) => void;
  onClose: () => void;
  saving: boolean;
}) => {
  const [perms, setPerms] = useState({
    canCreateTasks: member.canCreateTasks ?? false,
    canEditTasks: member.canEditTasks ?? false,
  });
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        zIndex: 1001,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
    >
      <div
        style={{
          background: "var(--bg-card)",
          borderRadius: "12px",
          padding: "1.75rem",
          maxWidth: "400px",
          width: "100%",
          boxShadow: "var(--shadow-modal)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1.25rem",
          }}
        >
          <h3
            style={{
              fontSize: "1rem",
              fontWeight: 700,
              color: "var(--text-primary)",
              margin: 0,
            }}
          >
            🔐 Permisos de {member.user?.name}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: "1.1rem",
              color: "var(--text-muted)",
            }}
          >
            ✕
          </button>
        </div>
        <p
          style={{
            fontSize: "0.83rem",
            color: "var(--text-secondary)",
            marginBottom: "1.25rem",
            lineHeight: 1.5,
          }}
        >
          Configura qué acciones puede realizar este miembro en el proyecto.
        </p>
        {[
          {
            key: "canCreateTasks",
            icon: "➕",
            title: "Crear tareas",
            desc: "Puede crear nuevas tareas en el proyecto",
          },
          {
            key: "canEditTasks",
            icon: "✏️",
            title: "Editar/eliminar tareas",
            desc: "Puede editar y eliminar tareas del proyecto",
          },
        ].map(({ key, icon, title, desc }) => (
          <div
            key={key}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0.85rem 1rem",
              background: "var(--bg-subtle)",
              borderRadius: "8px",
              marginBottom: "0.75rem",
              border: "1px solid var(--border-color)",
            }}
          >
            <div>
              <p
                style={{
                  fontWeight: 600,
                  fontSize: "0.9rem",
                  color: "var(--text-primary)",
                  margin: 0,
                }}
              >
                {icon} {title}
              </p>
              <p
                style={{
                  fontSize: "0.78rem",
                  color: "var(--text-secondary)",
                  margin: "0.15rem 0 0",
                }}
              >
                {desc}
              </p>
            </div>
            <button
              onClick={() =>
                setPerms((p) => ({ ...p, [key]: !p[key as keyof typeof p] }))
              }
              style={{
                width: "44px",
                height: "24px",
                borderRadius: "999px",
                border: "none",
                cursor: "pointer",
                background: perms[key as keyof typeof perms]
                  ? "#4f46e5"
                  : "#d1d5db",
                position: "relative",
                transition: "background 0.2s ease",
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: "2px",
                  left: perms[key as keyof typeof perms] ? "22px" : "2px",
                  width: "20px",
                  height: "20px",
                  borderRadius: "50%",
                  background: "#fff",
                  transition: "left 0.2s ease",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                }}
              />
            </button>
          </div>
        ))}
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button
            onClick={() => onSave(member.userId, perms)}
            disabled={saving}
            style={{ ...S.submitBtn, flex: 1 }}
          >
            {saving ? "Guardando..." : "💾 Guardar permisos"}
          </button>
          <button
            onClick={onClose}
            style={{ ...S.submitBtn, background: "#6b7280" }}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Componente Principal ─────────────────────────────────────────────────────
const ProjectDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [project, setProject] = useState<(Project & { tasks: Task[] }) | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => new Date());
  const clockRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    priority: "MEDIUM",
    dueDate: "",
    dueTime: "",
    assigneeId: "",
  });
  const [creating, setCreating] = useState(false);
  const [filterStatus, setFilterStatus] = useState("");
  const [editingTask, setEditingTask] = useState<any>(null);
  const [savingTask, setSavingTask] = useState(false);
  const [permMember, setPermMember] = useState<any>(null);
  const [savingPerms, setSavingPerms] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    status: "",
  });
  const [editing, setEditing] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "warning";
  } | null>(null);
  const [confirm, setConfirm] = useState<{
    message: string;
    onConfirm: () => void;
    confirmLabel?: string;
    danger?: boolean;
  } | null>(null);

  // ── NUEVO: controla qué task card tiene los comentarios abiertos ──────────
  const [expandedTaskId, setExpandedTaskId] = useState<number | null>(null);
  const toggleComments = (taskId: number) =>
    setExpandedTaskId((prev) => (prev === taskId ? null : taskId));

  const showToast = (
    msg: string,
    type: "success" | "error" | "warning" = "success",
  ) => setToast({ message: msg, type });
  const showConfirm = (
    msg: string,
    fn: () => void,
    label = "Confirmar",
    danger = false,
  ) => setConfirm({ message: msg, onConfirm: fn, confirmLabel: label, danger });

  useEffect(() => {
    clockRef.current = setInterval(() => setNow(new Date()), 60_000);
    return () => {
      if (clockRef.current) clearInterval(clockRef.current);
    };
  }, []);

  const fetchProject = async () => {
    try {
      const res = await api.get(`/projects/${id}`);
      const raw = res.data?.data ?? res.data;
      setProject({ ...raw, tasks: raw.tasks || [] });
    } catch {
      navigate("/projects");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProject();
  }, [id]);
  useEffect(() => {
    const h = () => setShowResults(false);
    document.addEventListener("click", h);
    return () => document.removeEventListener("click", h);
  }, []);

  const currentMember = project?.members?.find(
    (m: any) => m.userId === user?.id,
  );
  const isOwner = currentMember?.role === "OWNER";
  const myPermissions = isOwner
    ? { canCreateTasks: true, canEditTasks: true }
    : {
        canCreateTasks: currentMember?.canCreateTasks ?? false,
        canEditTasks: currentMember?.canEditTasks ?? false,
      };
  const canCreateTask = isOwner || myPermissions.canCreateTasks;
  const canEditTask = isOwner || myPermissions.canEditTasks;

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }
    setSearching(true);
    try {
      const res = await api.get(
        `/auth/users/search?q=${encodeURIComponent(query)}`,
      );
      const memberIds = project?.members?.map((m: any) => m.userId) || [];
      setSearchResults(
        res.data.data.filter((u: any) => !memberIds.includes(u.id)),
      );
      setShowResults(true);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleSelectUser = async (userResult: any) => {
    setShowResults(false);
    setSearchQuery("");
    setInviting(true);
    try {
      await api.post(`/projects/${id}/members`, { email: userResult.email });
      showToast(`¡${userResult.name} fue añadido al proyecto!`);
      fetchProject();
    } catch (err: any) {
      showToast(
        err.response?.data?.error || "Error al invitar usuario",
        "error",
      );
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = (memberId: number, memberName: string) => {
    showConfirm(
      `¿Quitar a ${memberName} del proyecto?`,
      async () => {
        setConfirm(null);
        setRemovingId(memberId);
        try {
          await api.delete(`/projects/${id}/members/${memberId}`);
          showToast(`${memberName} fue removido del proyecto.`);
          fetchProject();
        } catch (err: any) {
          showToast(
            err.response?.data?.error || "Error al quitar miembro",
            "error",
          );
        } finally {
          setRemovingId(null);
        }
      },
      "Quitar miembro",
      true,
    );
  };

  const handleLeaveProject = () => {
    showConfirm(
      "¿Quieres abandonar este proyecto?",
      async () => {
        setConfirm(null);
        try {
          await api.delete(`/projects/${id}/members/${user?.id}`);
          showToast("Abandonaste el proyecto.");
          setTimeout(() => navigate("/projects"), 1500);
        } catch (err: any) {
          showToast(err.response?.data?.error || "Error", "error");
        }
      },
      "Abandonar",
      true,
    );
  };

  const handleEditProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditing(true);
    try {
      await api.put(`/projects/${id}`, editForm);
      setShowEditForm(false);
      showToast("Proyecto actualizado.");
      fetchProject();
    } catch (err: any) {
      showToast(err.response?.data?.error || "Error al editar", "error");
    } finally {
      setEditing(false);
    }
  };

  const handleDeleteProject = () => {
    showConfirm(
      "¿Eliminar este proyecto? Esta acción no se puede deshacer.",
      async () => {
        setConfirm(null);
        try {
          await api.delete(`/projects/${id}`);
          navigate("/projects");
        } catch (err: any) {
          showToast(err.response?.data?.error || "Error", "error");
        }
      },
      "Eliminar proyecto",
      true,
    );
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      let dueDateISO: string | undefined;
      if (taskForm.dueDate)
        dueDateISO = new Date(
          `${taskForm.dueDate}T${taskForm.dueTime || "23:59"}:00`,
        ).toISOString();
      await api.post(`/tasks/project/${id}`, {
        title: taskForm.title,
        description: taskForm.description,
        priority: taskForm.priority,
        dueDate: dueDateISO,
        assigneeId: taskForm.assigneeId
          ? Number(taskForm.assigneeId)
          : undefined,
      });
      setTaskForm({
        title: "",
        description: "",
        priority: "MEDIUM",
        dueDate: "",
        dueTime: "",
        assigneeId: "",
      });
      setShowTaskForm(false);
      showToast("Tarea creada correctamente.");
      fetchProject();
    } catch (err: any) {
      showToast(err.response?.data?.error || "Error al crear tarea", "error");
    } finally {
      setCreating(false);
    }
  };

  const handleSaveEditTask = async (taskId: number, data: any) => {
    setSavingTask(true);
    try {
      await api.put(`/tasks/${taskId}`, data);
      setEditingTask(null);
      showToast("Tarea actualizada.");
      fetchProject();
    } catch (err: any) {
      showToast(
        err.response?.data?.error || "Error al actualizar tarea",
        "error",
      );
    } finally {
      setSavingTask(false);
    }
  };

  const handleStatusChange = async (taskId: number, status: string) => {
    try {
      await api.put(`/tasks/${taskId}`, { status });
      fetchProject();
    } catch {
      showToast("Error al actualizar tarea", "error");
    }
  };

  const handleDeleteTask = (taskId: number) => {
    showConfirm(
      "¿Eliminar esta tarea?",
      async () => {
        setConfirm(null);
        try {
          await api.delete(`/tasks/${taskId}`);
          showToast("Tarea eliminada.");
          fetchProject();
        } catch {
          showToast("Error al eliminar tarea", "error");
        }
      },
      "Eliminar",
      true,
    );
  };

  const handleSavePermissions = async (memberId: number, perms: any) => {
    setSavingPerms(true);
    try {
      await api.patch(`/projects/${id}/members/${memberId}/permissions`, perms);
      setPermMember(null);
      showToast("Permisos actualizados.");
      fetchProject();
    } catch (err: any) {
      showToast(
        err.response?.data?.error || "Error al actualizar permisos",
        "error",
      );
    } finally {
      setSavingPerms(false);
    }
  };

  const handleDeleteComment = async (taskId: number, commentId: number) => {
    // Usamos el ConfirmModal que ya tienes en tu código para que sea estético
    showConfirm(
      "¿Eliminar este comentario?",
      async () => {
        setConfirm(null);
        try {
          // 1. Llamada al backend corregido
          await api.delete(`/tasks/${taskId}/comments/${commentId}`);

          // 2. Actualización optimista del estado
          setProject((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              tasks: prev.tasks.map((t) => {
                if (t.id === taskId) {
                  return {
                    ...t,
                    // Filtramos el comentario eliminado de la lista
                    comments: (t as any).comments?.filter(
                      (c: any) => c.id !== commentId,
                    ),
                  };
                }
                return t;
              }),
            };
          });
          showToast("Comentario eliminado");
        } catch (err: any) {
          console.error(err);
          showToast(
            err.response?.data?.error || "No se pudo eliminar el comentario",
            "error",
          );
        }
      },
      "Eliminar",
      true,
    );
  };

  if (loading) return <div style={S.center}>Cargando proyecto...</div>;
  if (!project) return null;

  const filteredTasks = filterStatus
    ? project.tasks.filter((t) => t.status === filterStatus)
    : project.tasks;
  const completedCount = project.tasks.filter(
    (t) => t.status === "COMPLETED",
  ).length;
  const progress =
    project.tasks.length > 0
      ? Math.round((completedCount / project.tasks.length) * 100)
      : 0;
  const progressColor = getProgressColor(progress);
  const overdueCount = project.tasks.filter(
    (t) =>
      t.status !== "COMPLETED" &&
      (t as any).dueDate &&
      new Date((t as any).dueDate) < now,
  ).length;
  const previewDueDate = taskForm.dueDate
    ? new Date(`${taskForm.dueDate}T${taskForm.dueTime || "23:59"}:00`)
    : null;

  return (
    <div style={S.container}>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      {confirm && (
        <ConfirmModal
          message={confirm.message}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
          confirmLabel={confirm.confirmLabel}
          danger={confirm.danger}
        />
      )}
      {editingTask && (
        <EditTaskModal
          task={editingTask}
          members={project.members || []}
          onSave={handleSaveEditTask}
          onClose={() => setEditingTask(null)}
          saving={savingTask}
        />
      )}
      {permMember && (
        <PermissionsModal
          member={permMember}
          onSave={handleSavePermissions}
          onClose={() => setPermMember(null)}
          saving={savingPerms}
        />
      )}

      {/* ── Navbar compartido ── */}
      <Navbar />

      <div style={S.content}>
        <div style={S.projectHeader}>
          <div>
            <Link to="/projects" style={S.back}>
              ← Volver a Proyectos
            </Link>
            <h1 style={S.title}>{project.name}</h1>
            {project.description && (
              <p style={S.description}>{project.description}</p>
            )}
          </div>
          <div
            style={{ display: "flex", gap: "0.75rem", alignSelf: "flex-start" }}
          >
            {isOwner ? (
              <>
                <button
                  onClick={() => {
                    setEditForm({
                      name: project.name,
                      description: project.description || "",
                      status: project.status,
                    });
                    setShowEditForm(!showEditForm);
                  }}
                  style={S.editBtn}
                >
                  ✏️ Editar
                </button>
                <button onClick={handleDeleteProject} style={S.deleteBtn}>
                  🗑️ Eliminar
                </button>
              </>
            ) : (
              <button onClick={handleLeaveProject} style={S.leaveBtn}>
                🚪 Abandonar proyecto
              </button>
            )}
          </div>
        </div>

        {isOwner && showEditForm && (
          <div style={S.formCard}>
            <h3
              style={{
                fontSize: "1rem",
                fontWeight: 600,
                marginBottom: "1rem",
                color: "var(--text-primary)",
              }}
            >
              Editar Proyecto
            </h3>
            <form onSubmit={handleEditProject}>
              <div style={S.formRow}>
                <div style={{ ...S.field, flex: 2 }}>
                  <label style={S.label}>Nombre</label>
                  <input
                    style={S.input}
                    value={editForm.name}
                    onChange={(e) =>
                      setEditForm({ ...editForm, name: e.target.value })
                    }
                    required
                  />
                </div>
                <div style={S.field}>
                  <label style={S.label}>Estado</label>
                  <select
                    style={S.input}
                    value={editForm.status}
                    onChange={(e) =>
                      setEditForm({ ...editForm, status: e.target.value })
                    }
                  >
                    <option value="ACTIVE">Activo</option>
                    <option value="PAUSED">Pausado</option>
                    <option value="COMPLETED">Completado</option>
                  </select>
                </div>
              </div>
              <div style={S.field}>
                <label style={S.label}>Descripción</label>
                <textarea
                  style={{ ...S.input, height: "60px", resize: "vertical" }}
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm({ ...editForm, description: e.target.value })
                  }
                />
              </div>
              <div style={{ display: "flex", gap: "0.75rem" }}>
                <button style={S.submitBtn} type="submit" disabled={editing}>
                  {editing ? "Guardando..." : "Guardar cambios"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowEditForm(false)}
                  style={{ ...S.submitBtn, background: "#6b7280" }}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {!isOwner && !canCreateTask && (
          <div
            style={{
              background: "#fffbeb",
              border: "1px solid #f59e0b",
              borderLeft: "3px solid #f59e0b",
              borderRadius: "6px",
              padding: "0.65rem 1rem",
              marginBottom: "1rem",
              fontSize: "0.83rem",
              color: "#92400e",
            }}
          >
            ⚠️ Solo tienes permisos de <strong>visualización</strong>. El dueño
            del proyecto puede habilitarte permisos adicionales.
          </div>
        )}

        <div style={S.progressCard}>
          <div style={S.progressHeader}>
            <span style={S.progressLabel}>Progreso general</span>
            <div
              style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}
            >
              {overdueCount > 0 && (
                <span
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color: "#ef4444",
                    background: "#fee2e2",
                    padding: "0.15rem 0.6rem",
                    borderRadius: "999px",
                    border: "1px solid #fecaca",
                  }}
                >
                  🔴 {overdueCount} vencida{overdueCount > 1 ? "s" : ""}
                </span>
              )}
              <span style={{ ...S.progressPct, color: progressColor }}>
                {progress}%
              </span>
            </div>
          </div>
          <div style={S.progressBar}>
            <div
              style={{
                ...S.progressFill,
                width: `${progress}%`,
                background: progressColor,
              }}
            />
          </div>
          <div style={S.progressStats}>
            <span>📋 {project.tasks.length} tareas totales</span>
            <span>✅ {completedCount} completadas</span>
            <span>
              ⏳ {project.tasks.filter((t) => t.status === "PENDING").length}{" "}
              pendientes
            </span>
            <span>👥 {project.members?.length} miembros</span>
          </div>
        </div>

        <div style={S.grid}>
          {/* Columna Tareas */}
          <div style={{ flex: 2 }}>
            <div style={S.sectionHeader}>
              <h2 style={S.sectionTitle}>📋 Tareas</h2>
              <div style={{ display: "flex", gap: "0.75rem" }}>
                <select
                  style={S.select}
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <option value="">Todas</option>
                  <option value="PENDING">Pendientes</option>
                  <option value="IN_PROGRESS">En progreso</option>
                  <option value="COMPLETED">Completadas</option>
                </select>
                {canCreateTask && (
                  <button
                    onClick={() => setShowTaskForm(!showTaskForm)}
                    style={S.createBtn}
                  >
                    {showTaskForm ? "Cancelar" : "+ Tarea"}
                  </button>
                )}
              </div>
            </div>

            {showTaskForm && canCreateTask && (
              <div style={S.formCard}>
                <h3
                  style={{
                    fontSize: "0.95rem",
                    fontWeight: 600,
                    marginBottom: "1rem",
                    color: "var(--text-primary)",
                  }}
                >
                  Nueva Tarea
                </h3>
                <form onSubmit={handleCreateTask}>
                  <div style={S.formRow}>
                    <div style={{ ...S.field, flex: 2 }}>
                      <label style={S.label}>Título *</label>
                      <input
                        style={S.input}
                        value={taskForm.title}
                        onChange={(e) =>
                          setTaskForm({ ...taskForm, title: e.target.value })
                        }
                        placeholder="Título de la tarea"
                        required
                      />
                    </div>
                    <div style={S.field}>
                      <label style={S.label}>Prioridad</label>
                      <select
                        style={S.input}
                        value={taskForm.priority}
                        onChange={(e) =>
                          setTaskForm({ ...taskForm, priority: e.target.value })
                        }
                      >
                        <option value="LOW">🟢 Baja</option>
                        <option value="MEDIUM">🟡 Media</option>
                        <option value="HIGH">🔴 Alta</option>
                      </select>
                    </div>
                  </div>
                  <div style={S.formRow}>
                    <div style={S.field}>
                      <label style={S.label}>📅 Fecha límite</label>
                      <input
                        style={S.input}
                        type="date"
                        value={taskForm.dueDate}
                        min={new Date().toISOString().split("T")[0]}
                        onChange={(e) =>
                          setTaskForm({ ...taskForm, dueDate: e.target.value })
                        }
                      />
                    </div>
                    <div style={S.field}>
                      <label style={S.label}>
                        🕐 Hora límite{" "}
                        <span
                          style={{
                            fontSize: "0.7rem",
                            color: "var(--text-muted)",
                            fontWeight: 400,
                          }}
                        >
                          (por defecto 23:59)
                        </span>
                      </label>
                      <input
                        style={{
                          ...S.input,
                          background: !taskForm.dueDate ? "#f9fafb" : "#fff",
                          cursor: !taskForm.dueDate ? "not-allowed" : "default",
                        }}
                        type="time"
                        value={taskForm.dueTime}
                        onChange={(e) =>
                          setTaskForm({ ...taskForm, dueTime: e.target.value })
                        }
                        disabled={!taskForm.dueDate}
                      />
                    </div>
                    <div style={{ ...S.field, flex: 2 }}>
                      <label style={S.label}>👤 Asignar a</label>
                      <select
                        style={S.input}
                        value={taskForm.assigneeId}
                        onChange={(e) =>
                          setTaskForm({
                            ...taskForm,
                            assigneeId: e.target.value,
                          })
                        }
                      >
                        <option value="">Sin asignar</option>
                        {project.members?.map((m: any) => (
                          <option key={m.userId} value={m.userId}>
                            {m.user?.name} (
                            {m.role === "OWNER" ? "Owner" : "Member"})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {previewDueDate && (
                    <div
                      style={{
                        marginBottom: "0.75rem",
                        padding: "0.55rem 0.85rem",
                        background: "#f0f9ff",
                        borderRadius: "6px",
                        border: "1px solid #bae6fd",
                        fontSize: "0.82rem",
                        color: "#0369a1",
                      }}
                    >
                      📌 Vencerá el{" "}
                      <strong>
                        {previewDueDate.toLocaleDateString("es-PE", {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </strong>{" "}
                      a las{" "}
                      <strong>
                        {previewDueDate
                          .toLocaleTimeString("es-PE", {
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: true,
                          })
                          .toUpperCase()}
                      </strong>
                    </div>
                  )}
                  <div style={S.field}>
                    <label style={S.label}>Descripción</label>
                    <textarea
                      style={{ ...S.input, height: "64px", resize: "vertical" }}
                      value={taskForm.description}
                      onChange={(e) =>
                        setTaskForm({
                          ...taskForm,
                          description: e.target.value,
                        })
                      }
                      placeholder="Descripción opcional"
                    />
                  </div>
                  <div style={{ display: "flex", gap: "0.75rem" }}>
                    <button
                      style={S.submitBtn}
                      type="submit"
                      disabled={creating}
                    >
                      {creating ? "Creando..." : "Crear Tarea"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowTaskForm(false)}
                      style={{ ...S.submitBtn, background: "#6b7280" }}
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              </div>
            )}

            {filteredTasks.length === 0 && (
              <p style={S.empty}>
                No hay tareas {filterStatus ? "con este filtro" : "aún"}
              </p>
            )}

            {filteredTasks.map((task) => {
              const assigneeMember = project.members?.find(
                (m: any) => m.userId === (task as any).assigneeId,
              ) as any;
              const dueDate = (task as any).dueDate as string | undefined;
              const overdueInfo = getOverdueInfo(dueDate, task.status, now);
              const upcomingWarn = !overdueInfo
                ? getUpcomingWarning(dueDate, task.status, now)
                : null;
              // ── NUEVO: estado expandido para esta tarea ──
              const isExpanded = expandedTaskId === task.id;

              return (
                <div
                  key={task.id}
                  style={{
                    ...S.taskCard,
                    borderLeft: `4px solid ${overdueInfo ? "#ef4444" : priorityColor[task.priority]}`,
                    background: overdueInfo
                      ? overdueInfo.isCritical
                        ? "rgba(239, 68, 68, 0.1)"
                        : "rgba(249, 115, 22, 0.05)"
                      : "var(--bg-card)",

                    boxShadow: isExpanded
                      ? "0 4px 16px rgba(99,102,241,0.12), 0 1px 4px rgba(0,0,0,0.06)"
                      : "0 1px 4px rgba(0,0,0,0.08)",
                    transition: "box-shadow 0.2s",
                  }}
                >
                  <div style={S.taskHeader}>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                          flexWrap: "wrap",
                          marginBottom: "0.15rem",
                        }}
                      >
                        <p style={{ ...S.taskTitle, margin: 0 }}>
                          {task.title}
                        </p>
                        {overdueInfo && task.status !== "COMPLETED" && (
                          <span
                            style={{
                              fontSize: "0.68rem",
                              fontWeight: 700,
                              color: "#fff",
                              background: overdueInfo.isCritical
                                ? "#ef4444"
                                : "#f97316",
                              padding: "0.15rem 0.55rem",
                              borderRadius: "999px",
                              whiteSpace: "nowrap",
                              animation: overdueInfo.isCritical
                                ? "blink 2s ease-in-out infinite"
                                : undefined,
                            }}
                          >
                            🔴 {overdueInfo.label}
                          </span>
                        )}
                        {upcomingWarn && (
                          <span
                            style={{
                              fontSize: "0.68rem",
                              fontWeight: 700,
                              color: "#fff",
                              background: "#f59e0b",
                              padding: "0.15rem 0.55rem",
                              borderRadius: "999px",
                              whiteSpace: "nowrap",
                            }}
                          >
                            ⚠️ {upcomingWarn}
                          </span>
                        )}
                      </div>
                      {task.description && (
                        <p style={S.taskDesc}>{task.description}</p>
                      )}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: "0.4rem",
                        alignItems: "center",
                      }}
                    >
                      <span
                        style={{
                          ...S.priorityBadge,
                          background: priorityColor[task.priority],
                        }}
                      >
                        {priorityLabel[task.priority]}
                      </span>
                      {canEditTask && (
                        <button
                          onClick={() => setEditingTask(task)}
                          style={{
                            ...S.iconBtn,
                            background: "#f0f9ff",
                            borderRadius: "6px",
                            padding: "0.2rem 0.45rem",
                            border: "1px solid #bae6fd",
                            color: "#0369a1",
                          }}
                          title="Editar tarea"
                        >
                          ✏️
                        </button>
                      )}
                      {canEditTask && (
  <button
    onClick={() => handleDeleteTask(task.id)}
    style={{
      ...S.iconBtn, 
      background: 'rgba(239, 68, 68, 0.1)', // Añade este fondo rojo suave
      color: '#ef4444',                    // Color rojo para el icono
      padding: '0.3rem',
      borderRadius: '6px',
      opacity: 1                           // Sube la opacidad al máximo
    }}
    title="Eliminar tarea"
  >
    🗑️
  </button>
)}
                    </div>
                  </div>
                  {/* Footer: estado · fecha · asignado · toggle comentarios */}
                  <div
                    style={{
                      ...S.taskFooter,
                      borderTop: "1px solid var(--border-color)",
                      paddingTop: "0.6rem",
                      marginTop: "0.5rem",
                    }}
                  >
                    <select
                      style={{
                        ...S.statusSelect,
                        background: statusColor[task.status],
                        color: statusTextColor[task.status],
                      }}
                      value={task.status}
                      onChange={(e) =>
                        handleStatusChange(task.id, e.target.value)
                      }
                    >
                      <option value="PENDING">{statusLabel["PENDING"]}</option>
                      <option value="IN_PROGRESS">
                        {statusLabel["IN_PROGRESS"]}
                      </option>
                      <option value="COMPLETED">
                        {statusLabel["COMPLETED"]}
                      </option>
                    </select>
                    {dueDate && (
                      <span
                        style={{
                          fontSize: "0.78rem",
                          fontWeight: overdueInfo ? 700 : 500,
                          color: overdueInfo
                            ? overdueInfo.isCritical
                              ? "#ff6b6b"
                              : "#fb923c"
                            : upcomingWarn
                              ? "#b45309" // tono mas visible para "vence hoy"
                              : "var(--text-secondary)", // usa variable de tema en lugar de blanco fijo
                        }}
                      >
                        📅 {formatDueDateTime(dueDate)}
                      </span>
                    )}
                    {(task as any).assignee && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.4rem",
                          marginLeft: "auto",
                        }}
                      >
                        <Avatar
                          name={(task as any).assignee.name}
                          avatarUrl={assigneeMember?.user?.avatarUrl}
                          avatarColor={assigneeMember?.user?.avatarColor}
                          size={24}
                        />
                        {/* CAMBIO AQUÍ: Color de gris a blanco para modo noche */}
                        <span
                          style={{
                            fontSize: "0.78rem",
                            color: "var(--text-primary)", // usa variable de tema en lugar de blanco fijo
                            fontWeight: 500,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {(task as any).assignee.name}
                        </span>
                      </div>
                    )}

                    {/* ── NUEVO: Toggle de comentarios ── */}
                    <button
                      onClick={() => toggleComments(task.id)}
                      title={
                        isExpanded ? "Ocultar comentarios" : "Ver comentarios"
                      }
                      style={{
                        marginLeft: (task as any).assignee ? "0" : "auto",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.3rem",
                        // Corregido: eliminada la doble palabra 'background' y usado var
                        background: isExpanded
                          ? "rgba(99, 102, 241, 0.15)"
                          : "var(--bg-subtle)",
                        // Corregido: bordes adaptativos
                        border: `1px solid ${isExpanded ? "var(--color-primary)" : "var(--border-color)"}`,
                        borderRadius: "6px",
                        padding: "0.25rem 0.65rem",
                        cursor: "pointer",
                        fontSize: "0.75rem",
                        fontWeight: isExpanded ? 700 : 500,
                        // Corregido: color de texto adaptativo
                        color: isExpanded
                          ? "var(--color-primary)"
                          : "var(--text-secondary)",
                        transition: "all 0.15s",
                        flexShrink: 0,
                      }}
                    >
                      💬 {isExpanded ? "Ocultar ▲" : "Comentarios ▼"}
                    </button>
                  </div>

                  {/* ── NUEVO: Sección de comentarios expandible ──
                      Fetch lazy: se monta al abrir, se desmonta al cerrar.
                      readOnly respeta los permisos RBAC del usuario.        */}
                  {isExpanded && (
                    <TaskComments
                      taskId={task.id}
                      currentUser={
                        user ? { id: user.id, name: user.name } : null
                      }
                      readOnly={!canEditTask}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Panel Miembros */}
          <div style={{ flex: 1 }}>
            <div style={S.membersCard}>
              <h2 style={S.sectionTitle}>👥 Miembros</h2>
              {isOwner && (
                <div
                  style={{ margin: "0.75rem 0 1rem", position: "relative" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div style={{ position: "relative" }}>
                    <input
                      style={S.inviteInput}
                      type="text"
                      placeholder="Buscar por nombre o email..."
                      value={searchQuery}
                      onChange={(e) => handleSearch(e.target.value)}
                      onFocus={() =>
                        searchResults.length > 0 && setShowResults(true)
                      }
                      disabled={inviting}
                    />
                    {(searching || inviting) && (
                      <span
                        style={{
                          position: "absolute",
                          right: "0.75rem",
                          top: "50%",
                          transform: "translateY(-50%)",
                          fontSize: "0.8rem",
                        }}
                      >
                        {inviting ? "✅" : "⏳"}
                      </span>
                    )}
                  </div>
                  {showResults && (
                    <div
                      style={{
                        position: "absolute",
                        top: "calc(100% + 4px)",
                        left: 0,
                        right: 0,
                        background: "var(--bg-card)",
                        border: "1px solid var(--border-color)",
                        borderRadius: "8px",
                        boxShadow: "var(--shadow-card)",
                        zIndex: 100,
                        overflow: "hidden",
                      }}
                    >
                      {searchResults.length > 0 ? (
                        searchResults.map((u) => (
                          <button
                            key={u.id}
                            onClick={() => handleSelectUser(u)}
                            style={{
                              width: "100%",
                              display: "flex",
                              alignItems: "center",
                              gap: "0.75rem",
                              padding: "0.65rem 0.75rem",
                              background: "none",
                              border: "none",
                              borderBottom: "1px solid var(--border-light)",
                              cursor: "pointer",
                              textAlign: "left",
                            }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.background =
                                "var(--bg-subtle)")
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.background =
                                "var(--bg-card)")
                            }
                          >
                            <Avatar
                              name={u.name}
                              avatarUrl={u.avatarUrl}
                              avatarColor={u.avatarColor}
                              size={30}
                            />
                            <div>
                              <p
                                style={{
                                  margin: 0,
                                  fontSize: "0.85rem",
                                  fontWeight: 500,
                                }}
                              >
                                {u.name}
                              </p>
                              <p
                                style={{
                                  margin: 0,
                                  fontSize: "0.75rem",
                                  color: "#888",
                                }}
                              >
                                {u.email}
                              </p>
                            </div>
                          </button>
                        ))
                      ) : (
                        <p
                          style={{
                            padding: "0.75rem",
                            color: "var(--text-muted)",
                            fontSize: "0.85rem",
                            margin: 0,
                            textAlign: "center",
                          }}
                        >
                          No se encontraron usuarios
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
              {project.members?.map((member: any) => {
                const isMe = member.userId === user?.id;
                return (
                  <div key={member.userId} style={S.memberItem}>
                    <Avatar
                      name={member.user?.name}
                      avatarUrl={member.user?.avatarUrl}
                      avatarColor={member.user?.avatarColor}
                      size={36}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={S.memberName}>
                        {member.user?.name}{" "}
                        {isMe && (
                          <span
                            style={{ fontSize: "0.7rem", color: "#94a3b8" }}
                          >
                            (tú)
                          </span>
                        )}
                      </p>
                      <p style={S.memberEmail}>{member.user?.email}</p>
                      {member.role !== "OWNER" && (
                        <div
                          style={{
                            display: "flex",
                            gap: "0.3rem",
                            marginTop: "0.25rem",
                            flexWrap: "wrap",
                          }}
                        >
                          {member.canCreateTasks && (
                            <span
                              style={{
                                fontSize: "0.62rem",
                                background: "#ede9fe",
                                color: "#4f46e5",
                                padding: "0.05rem 0.4rem",
                                borderRadius: "999px",
                                fontWeight: 600,
                              }}
                            >
                              ➕ Crear
                            </span>
                          )}
                          {member.canEditTasks && (
                            <span
                              style={{
                                fontSize: "0.62rem",
                                background: "#cffafe",
                                color: "#0891b2",
                                padding: "0.05rem 0.4rem",
                                borderRadius: "999px",
                                fontWeight: 600,
                              }}
                            >
                              ✏️ Editar
                            </span>
                          )}
                          {!member.canCreateTasks && !member.canEditTasks && (
                            <span
                              style={{
                                fontSize: "0.62rem",
                                background: "#f1f5f9",
                                color: "#94a3b8",
                                padding: "0.05rem 0.4rem",
                                borderRadius: "999px",
                              }}
                            >
                              👁 Solo lectura
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    {member.role === "OWNER" ? (
                      <span style={S.ownerBadge}>👑 Owner</span>
                    ) : (
                      isOwner && (
                        <div
                          style={{
                            display: "flex",
                            gap: "0.4rem",
                            alignItems: "center",
                          }}
                        >
                          <button
                            onClick={() => setPermMember(member)}
                            style={{
                              background: "#ede9fe",
                              color: "#4f46e5",
                              border: "none",
                              width: "26px",
                              height: "26px",
                              borderRadius: "50%",
                              cursor: "pointer",
                              fontSize: "0.75rem",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                            title="Gestionar permisos"
                          >
                            🔐
                          </button>
                          <button
                            onClick={() =>
                              handleRemoveMember(
                                member.userId,
                                member.user?.name,
                              )
                            }
                            disabled={removingId === member.userId}
                            style={S.removeMemberBtn}
                            title="Quitar miembro"
                          >
                            {removingId === member.userId ? "..." : "✕"}
                          </button>
                        </div>
                      )
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <style>{`@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }`}</style>
    </div>
  );
};

const S: Record<string, React.CSSProperties> = {
  container: { minHeight: "100vh", background: "var(--bg-app)" },
  center: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100vh",
  },
  content: {
    padding: "2rem 5%",
    maxWidth: "1440px",
    margin: "0 auto",
    boxSizing: "border-box",
  },
  projectHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "1.5rem",
    background: "var(--bg-card)",
    padding: "1.5rem",
    borderRadius: "8px",
    boxShadow: "var(--shadow-card)",
  },
  back: {
    fontSize: "0.85rem",
    color: "#4f46e5",
    display: "block",
    marginBottom: "0.5rem",
    textDecoration: "none",
  },
  title: {
    fontSize: "1.6rem",
    fontWeight: 700,
    color: "var(--text-primary)",
    marginBottom: "0.3rem",
    margin: "0 0 0.3rem",
  },
  description: {
    fontSize: "0.9rem",
    color: "var(--text-secondary)",
    maxWidth: "600px",
    margin: 0,
  },
  editBtn: {
    background: "#e0e7ff",
    color: "#4f46e5",
    border: "1px solid #c7d2fe",
    padding: "0.5rem 1rem",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "0.85rem",
    fontWeight: 500,
    whiteSpace: "nowrap",
  },
  deleteBtn: {
    background: "#fee2e2",
    color: "#ef4444",
    border: "1px solid #fecaca",
    padding: "0.5rem 1rem",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "0.85rem",
    fontWeight: 500,
    whiteSpace: "nowrap",
  },
  leaveBtn: {
    background: "#fff7ed",
    color: "#ea580c",
    border: "1px solid #fed7aa",
    padding: "0.5rem 1rem",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "0.85rem",
    fontWeight: 500,
    whiteSpace: "nowrap",
  },
  progressCard: {
    background: "var(--bg-card)",
    padding: "1.25rem",
    borderRadius: "8px",
    boxShadow: "var(--shadow-card)",
    marginBottom: "1.5rem",
  },
  progressHeader: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "0.5rem",
    alignItems: "center",
  },
  progressLabel: { fontSize: "0.9rem", fontWeight: 500 },
  progressPct: { fontSize: "0.9rem", fontWeight: 700 },
  progressBar: {
    height: "8px",
    background: "var(--border-color)",
    borderRadius: "999px",
    overflow: "hidden",
    marginBottom: "0.75rem",
  },
  progressFill: {
    height: "100%",
    borderRadius: "999px",
    transition: "width 0.4s ease",
  },
  progressStats: {
    display: "flex",
    gap: "1.5rem",
    fontSize: "0.85rem",
    color: "var(--text-secondary)",
    flexWrap: "wrap",
  },
  grid: {
    display: "flex",
    gap: "2rem",
    flexWrap: "wrap",
    alignItems: "flex-start",
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "1rem",
  },
  sectionTitle: {
    fontSize: "1rem",
    fontWeight: 600,
    color: "var(--text-primary)",
    margin: 0,
  },
  select: {
    padding: "0.4rem 0.75rem",
    border: "1px solid var(--border-color)",
    borderRadius: "6px",
    fontSize: "0.85rem",
    background: "var(--bg-card)",
  },
  createBtn: {
    background: "#4f46e5",
    color: "#fff",
    border: "none",
    padding: "0.4rem 1rem",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "0.85rem",
    fontWeight: 600,
  },
  formCard: {
    background: "var(--bg-card)",
    padding: "1.25rem",
    borderRadius: "8px",
    boxShadow: "var(--shadow-card)",
    marginBottom: "1rem",
  },
  formRow: { display: "flex", gap: "1rem", flexWrap: "wrap" },
  field: { marginBottom: "0.75rem", flex: 1, minWidth: "140px" },
  label: {
    display: "block",
    marginBottom: "0.3rem",
    fontWeight: 500,
    fontSize: "0.85rem",
    color: "var(--text-primary)",
  },
  input: {
    width: "100%",
    padding: "0.55rem",
    border: "1px solid var(--border-color)",
    borderRadius: "4px",
    fontSize: "0.9rem",
    boxSizing: "border-box",
    fontFamily: "inherit",
  },
  submitBtn: {
    background: "#4f46e5",
    color: "#fff",
    border: "none",
    padding: "0.55rem 1.25rem",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "0.9rem",
    fontWeight: 600,
  },
  taskCard: {
    background: "var(--bg-card)",
    padding: "1.25rem",
    borderRadius: "8px",
    boxShadow: "var(--shadow-card)",
    marginBottom: "1rem",
  },
  taskHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "0.5rem",
  },
  taskTitle: {
    fontWeight: 500,
    fontSize: "0.95rem",
    color: "var(--text-primary)",
    margin: 0,
  },
  taskDesc: {
    fontSize: "0.83rem",
    color: "var(--text-secondary)",
    margin: "0.25rem 0 0",
  },
  taskFooter: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    flexWrap: "wrap",
  },
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
    padding: "0.2rem 0.65rem",
    fontSize: "0.78rem",
    fontWeight: 600,
    cursor: "pointer",
  },
  iconBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: "0.9rem",
    opacity: 0.7,
  },
  membersCard: {
    background: "var(--bg-card)",
    padding: "1.5rem",
    borderRadius: "8px",
    boxShadow: "var(--shadow-card)",
    width: "100%",
    boxSizing: "border-box",
  },
  inviteInput: {
    width: "100%",
    padding: "0.55rem 2rem 0.55rem 0.75rem",
    border: "1px solid var(--border-color)",
    borderRadius: "6px",
    fontSize: "0.85rem",
    boxSizing: "border-box",
    fontFamily: "inherit",
  },
  memberItem: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    padding: "0.7rem 0",
    borderBottom: "1px solid var(--border-light)",
  },
  memberName: { fontWeight: 500, fontSize: "0.88rem", margin: 0 },
  memberEmail: { fontSize: "0.78rem", color: "var(--text-muted)", margin: 0 },
  ownerBadge: {
    fontSize: "0.7rem",
    background: "#e0e7ff",
    color: "#4f46e5",
    padding: "0.2rem 0.5rem",
    borderRadius: "999px",
    fontWeight: 600,
    whiteSpace: "nowrap",
  },
  removeMemberBtn: {
    background: "#fee2e2",
    color: "#ef4444",
    border: "none",
    width: "26px",
    height: "26px",
    borderRadius: "50%",
    cursor: "pointer",
    fontSize: "0.75rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  empty: {
    color: "var(--text-muted)",
    textAlign: "center",
    padding: "2rem",
    fontSize: "0.9rem",
  },
};

export default ProjectDetail;
