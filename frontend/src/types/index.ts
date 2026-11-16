export interface User {
  id: number;
  name: string;
  email: string;
  role: "ADMIN" | "MEMBER";
  avatarColor?: string | null;
  avatarUrl?: string | null; // ← NUEVO
  createdAt?: string;
}

export interface Project {
  tasks?: Task[];
  id: number;
  name: string;
  description?: string | null;
  status: "ACTIVE" | "PAUSED" | "COMPLETED";
  createdAt: string;
  updatedAt: string;
  members: ProjectMember[];
  _count?: { tasks: number };
}

export interface ProjectMember {
  userId: number;
  projectId: number;
  role: "OWNER" | "MEMBER"; // ← agrega esto
  canCreateTasks: boolean;
  canEditTasks: boolean;
  user: User;
}

export type TaskMutation = TaskUpdate & { expectedVersion: number };
export type TaskUpdate = Partial<Pick<Task, 'title' | 'description' | 'priority' | 'status' | 'dueDate' | 'assigneeId'>>;
export interface Task {
  version: number;
  saving?: boolean;
  uncertain?: boolean;
  project?: { id: number; name: string };
  canEdit?: boolean;
  canModerateComments?: boolean;
  id: number;
  title: string;
  description?: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH";
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  dueDate?: string | null;
  projectId: number;
  assigneeId?: number | null;
  assignee?: User | null;
  createdAt: string;
  updatedAt: string; // 👈 Clave para mostrar "Editado hace..."
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
