import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
  interface User {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    /** Password fingerprint; see checkPasswordSession in src/lib/auth.ts. */
    pwf?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    pwf?: string;
    pwCheckedAt?: number;
  }
}
