export type UserRole = "administrador" | "docente" | "estudiante";

export interface AuthUser {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
}
