export interface MenuItemDef {
  title: string;
  description: string;
  route: string;
  primary?: boolean;
}

export const WORKER_MENU_ITEMS: MenuItemDef[] = [
  {
    title: "Mis tareas",
    description: "Ver pendientes y marcar como hechas",
    route: "/",
    primary: true,
  },
  {
    title: "Calendario",
    description: "Tareas programadas por día o semana",
    route: "/calendar",
  },
  {
    title: "Cuadrante",
    description: "Turnos publicados del equipo",
    route: "/roster",
  },
  {
    title: "Asumir tareas",
    description: "Tomar tareas asignadas a otras personas",
    route: "/others",
  },
  {
    title: "Tareas realizadas",
    description: "Historial de lo que has completado",
    route: "/completed",
  },
  {
    title: "Mi ficha",
    description: "Datos personales y contraseña",
    route: "/profile",
  },
  {
    title: "Salir",
    description: "Cerrar sesión en este dispositivo",
    route: "__logout__",
  },
];

export const ADMIN_MENU_ITEMS: MenuItemDef[] = [
  {
    title: "Nueva tarea",
    description: "Crear y asignar tareas al personal",
    route: "/admin-new-task",
    primary: true,
  },
  {
    title: "Calendario",
    description: "Ver tareas programadas",
    route: "/calendar",
  },
  {
    title: "Cuadrante",
    description: "Marcar turnos, cerrar y publicar la semana",
    route: "/admin-roster",
  },
  {
    title: "Personal",
    description: "Altas, fichas y disponibilidad del equipo",
    route: "/admin-staff",
  },
  {
    title: "Mis tareas",
    description: "Marcar como hechas las tuyas asignadas",
    route: "/",
  },
  {
    title: "Asumir tareas",
    description: "Tomar o completar tareas de otras personas",
    route: "/others",
  },
  {
    title: "Tareas realizadas",
    description: "Historial de lo que has completado",
    route: "/completed",
  },
  {
    title: "Revisión",
    description: "Chequear tareas realizadas por el personal",
    route: "/admin-revision",
  },
  {
    title: "Auditoría",
    description: "Historial de tareas chequeadas",
    route: "/admin-audit",
  },
  {
    title: "Mi ficha",
    description: "Datos personales y contraseña",
    route: "/profile",
  },
  {
    title: "Salir",
    description: "Cerrar sesión en este dispositivo",
    route: "__logout__",
  },
];
