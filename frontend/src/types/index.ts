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
  id: number;
  name: string;
  description?: string;
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

export interface Task {
  id: number;
  title: string;
  description?: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  dueDate?: string;
  projectId: number;
  assigneeId?: number;
  assignee?: User;
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
