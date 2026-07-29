/** Roles de acceso a la aplicación */
export type UserRole = "ADMIN" | "WORKER";

/** Tipo de personal GREFA */
export type UserType = "TRABAJADOR_GREFA" | "VOLUNTARIO";

/** Estado del ciclo de vida de una tarea */
export type TaskStatus = "PENDING" | "IN_REVIEW" | "COMPLETED";

export interface User {
  uid: string;
  fullName: string;
  dni: string;
  email: string;
  phone: string;
  role: UserRole;
  userType: UserType;
  active: boolean;
  fcmToken?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AssignedUserInfo {
  uid: string;
  fullName: string;
  userType: UserType;
  dni: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  createdBy: string;
  assignedUserIds: string[];
  assignedUsersInfo: AssignedUserInfo[];
  status: TaskStatus;
  totalAmount: number;
  taskDate: unknown;
  createdAt: unknown;
}

export interface TaskLog {
  id: string;
  taskId: string;
  completionDate: unknown;
  assignedUsersList: Array<{ fullName: string; dni: string; uid?: string }>;
  completedByUserId: string;
  completedByName: string;
  wasAssignedToHim: boolean;
  supervisorId?: string;
  comments: string;
  concatenatedText: string;
  locationDateText: string;
  totalAmount?: number;
}

export const USER_TYPE_LABELS: Record<UserType, string> = {
  TRABAJADOR_GREFA: "Trabajador de GREFA",
  VOLUNTARIO: "Voluntario",
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  PENDING: "Pendiente",
  IN_REVIEW: "En revisión",
  COMPLETED: "Completada",
};
