declare namespace Express {
  interface Request {
    user?: {
      id: number;
      sub: string;
      role: "user" | "professional" | "admin";
      email?: string;
    };
  }
}
