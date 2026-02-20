import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db";
import * as schema from "@/db/schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 6,
    autoSignIn: true,
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "employee",
        input: true,
      },
      departmentId: {
        type: "string",
        required: false,
        input: true,
      },
      freeePartnerId: {
        type: "number",
        required: false,
        input: true,
      },
      isActive: {
        type: "boolean",
        required: false,
        defaultValue: true,
        input: true,
      },
      isHidden: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: true,
      },
      mustChangePassword: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: true,
      },
      sortOrder: {
        type: "number",
        required: false,
        defaultValue: 9999,
        input: true,
      },
      invitedAt: {
        type: "date",
        required: false,
        input: true,
      },
    },
  },
  session: {
    expiresIn: 8 * 60 * 60,
    updateAge: 60 * 60,
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },
  trustedOrigins: [
    process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  ],
});

export type Session = typeof auth.$Infer.Session;
export type AuthUser = typeof auth.$Infer.Session.user & {
  role: string;
  departmentId: string | null;
  freeePartnerId: number | null;
  isActive: boolean;
  isHidden: boolean;
  mustChangePassword: boolean;
  sortOrder: number;
  invitedAt: Date | null;
};
