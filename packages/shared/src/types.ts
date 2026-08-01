/** Roles de acceso a la aplicación */
export type UserRole = "ADMIN" | "WORKER";

/** Tipo de personal GREFA */
export type UserType = "TRABAJADOR_GREFA" | "VOLUNTARIO" | "PERSONAL_PRACTICAS";

/**
 * Días y horas en que se espera a una persona cada semana.
 * Sirve para autorrellenar el cuadrante sin escribir marcas día a día.
 */
export interface WeeklySchedule {
  /** 1 = lunes … 7 = domingo */
  weekdays: number[];
  startTime?: string;
  endTime?: string;
  /** YYYY-MM-DD: primer día del voluntariado o las prácticas */
  fromDate?: string;
  /** YYYY-MM-DD: último día */
  toDate?: string;
}

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
  startDate?: unknown;
  endDate?: unknown;
  /** Horario semanal previsto (null o ausente = sin horario fijo) */
  schedule?: WeeklySchedule | null;
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
  taskDate: unknown;
  startTime?: string;
  endTime?: string;
  assignedToAll?: boolean;
  completedAt?: unknown;
  completedBy?: string;
  completedByName?: string;
  /** Observaciones del asignado al marcar como hecha (informe diario) */
  completionNotes?: string;
  /** Falta de material reportada por el personal */
  materialShortage?: string;
  auditedAt?: unknown;
  auditedBy?: string;
  /** Misma serie si la tarea se creó con repetición diaria */
  recurrenceId?: string;
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
  comments: string;
  materialShortage?: string;
  taskTitle: string;
  taskDescription: string;
  taskScheduledDate?: unknown;
  taskStartTime?: string;
  taskEndTime?: string;
  audited?: boolean;
  auditedAt?: unknown;
  auditedBy?: string;
}

export const USER_TYPE_LABELS: Record<UserType, string> = {
  TRABAJADOR_GREFA: "Trabajador de GREFA",
  VOLUNTARIO: "Voluntario",
  PERSONAL_PRACTICAS: "Personal en prácticas",
};

/** Etiqueta corta para tablas y cuadrante. */
export const USER_TYPE_SHORT: Record<UserType, string> = {
  TRABAJADOR_GREFA: "Trabajador",
  VOLUNTARIO: "Voluntario",
  PERSONAL_PRACTICAS: "Prácticas",
};

/** Orden de aparición del personal en listas y cuadrante. */
export const USER_TYPE_ORDER: Record<UserType, number> = {
  TRABAJADOR_GREFA: 0,
  VOLUNTARIO: 1,
  PERSONAL_PRACTICAS: 2,
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  PENDING: "Pendiente",
  IN_REVIEW: "En revisión",
  COMPLETED: "Completada",
};
