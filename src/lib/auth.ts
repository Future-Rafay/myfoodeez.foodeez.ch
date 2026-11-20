import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import { enforceRateLimit, LOGIN_LIMITS, RateLimitError } from "@/lib/rate-limit";

export const MIN_PASSWORD_LENGTH = 8;

const PASSWORD_SESSION_RECHECK_MS = 10 * 60 * 1000;

/**
 * Reset links carry crypto.randomBytes(32).toString('hex'). Anything else is rejected before it
 * reaches Prisma, which would read an object such as {"not": ""} as a filter matching any account.
 */
export const isResetToken = (value: unknown): value is string =>
  typeof value === "string" && /^[a-f0-9]{64}$/.test(value);

/** Short hash of the stored password hash; it changes whenever the password is reset, changed or cleared. */
export const passwordFingerprint = (hash: string | null | undefined) =>
  hash ? createHash("sha256").update(hash).digest("hex").slice(0, 16) : null;

/**
 * Same contract as the customer site: at most every 10 minutes a session compares its password
 * fingerprint with the account, so a reset or password change on either app ends older sessions.
 * Returns false when the session must end.
 */
export async function checkPasswordSession(
  token: { email?: string | null; pwf?: string; pwCheckedAt?: number },
  readPassword: (email: string) => Promise<string | null | undefined>,
  now = Date.now()
) {
  if (!token.pwf || now - (token.pwCheckedAt ?? 0) < PASSWORD_SESSION_RECHECK_MS) return true;
  let password;
  try {
    password = await readPassword(token.email ?? "");
  } catch (error) {
    // A database blip must not sign everyone out; the next request checks again.
    console.error("[Session] Password check failed:", error);
    return true;
  }
  if (passwordFingerprint(password) !== token.pwf) return false;
  token.pwCheckedAt = now;
  return true;
}

const readPassword = async (email: string) =>
  (await prisma.visitors_account.findUnique({ where: { EMAIL_ADDRESS: email }, select: { PASSWORD: true } }))?.PASSWORD;

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        if (typeof credentials?.email !== "string" || typeof credentials?.password !== "string" || !credentials.email || !credentials.password) {
          throw new Error("Invalid credentials");
        }
        const email = credentials.email.trim().toLowerCase();

        try {
          await enforceRateLimit(new Headers(req.headers as Record<string, string>), "login", email, LOGIN_LIMITS);
        } catch (error) {
          if (error instanceof RateLimitError) throw new Error("Too many sign-in attempts. Please wait and try again.");
          throw error;
        }

        const user = await prisma.visitors_account.findUnique({
          where: { EMAIL_ADDRESS: email },
        });

        if (!user || !user.PASSWORD) {
          throw new Error("Invalid credentials");
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.PASSWORD
        );

        if (!isPasswordValid) {
          throw new Error("Invalid credentials");
        }

        return {
          id: user.VISITORS_ACCOUNT_ID.toString(),
          name: `${user.FIRST_NAME} ${user.LAST_NAME}`,
          email: user.EMAIL_ADDRESS,
          image: user.PIC,
          pwf: passwordFingerprint(user.PASSWORD) ?? undefined,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
    signOut: "/",
  },
  callbacks: {
    async signIn() {
      return true;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.id || token.sub || "");
        session.user.name = token.name;
        session.user.email = token.email;
        session.user.image = token.picture;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.email = user.email;
        token.picture = user.image;
        token.pwf = user.pwf;
        token.pwCheckedAt = Date.now();
        return token;
      }
      // Throwing here makes NextAuth clear the session cookie.
      if (!(await checkPasswordSession(token, readPassword))) throw new Error("Session ended: password changed");
      return token;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
