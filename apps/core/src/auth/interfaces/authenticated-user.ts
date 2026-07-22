export interface AuthenticatedUser {
  authType: string;
  email: string;
  exp: number;
  iat: number;
  rol: { id: string; name: string };
  userId: string;
}
