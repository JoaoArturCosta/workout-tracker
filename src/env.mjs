import { z } from "zod";
import { config } from "dotenv";

// Load environment variables from .env.local
config({ path: ".env.local" });

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),

  // NextAuth
  NEXTAUTH_SECRET: z.string().min(1),
  NEXTAUTH_URL: z.string().url(),

  // Google OAuth
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),

  // Rest-finished alerts. Development can run in foreground-only mode.
  QSTASH_TOKEN: z.string().min(1).optional(),
  QSTASH_CURRENT_SIGNING_KEY: z.string().min(1).optional(),
  QSTASH_NEXT_SIGNING_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().min(1).optional(),
  VAPID_PRIVATE_KEY: z.string().min(1).optional(),
  VAPID_SUBJECT: z
    .string()
    .refine(
      (value) => {
        if (value.startsWith("mailto:")) {
          return value.length > "mailto:".length;
        }
        const parsed = z.string().url().safeParse(value);
        return parsed.success && new URL(value).protocol === "https:";
      },
      "VAPID_SUBJECT must be a mailto: address or HTTPS URL"
    )
    .optional(),
  APP_URL: z
    .string()
    .url()
    .refine((value) => new URL(value).protocol === "https:", {
      message: "APP_URL must use HTTPS",
    })
    .optional(),

  // Node Environment
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
}).superRefine((values, context) => {
  if (values.NODE_ENV !== "production") {
    return;
  }

  const requiredAlertKeys = [
    "QSTASH_TOKEN",
    "QSTASH_CURRENT_SIGNING_KEY",
    "QSTASH_NEXT_SIGNING_KEY",
    "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
    "VAPID_PRIVATE_KEY",
    "VAPID_SUBJECT",
    "APP_URL",
  ];
  for (const key of requiredAlertKeys) {
    if (!values[key]) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [key],
        message: `${key} is required in production`,
      });
    }
  }
});

const processEnv = {
  DATABASE_URL: process.env.DATABASE_URL,
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
  NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  QSTASH_TOKEN: process.env.QSTASH_TOKEN,
  QSTASH_CURRENT_SIGNING_KEY: process.env.QSTASH_CURRENT_SIGNING_KEY,
  QSTASH_NEXT_SIGNING_KEY: process.env.QSTASH_NEXT_SIGNING_KEY,
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
  VAPID_SUBJECT: process.env.VAPID_SUBJECT,
  APP_URL: process.env.APP_URL,
  NODE_ENV: process.env.NODE_ENV,
};

// Validate environment variables
const env = envSchema.parse(processEnv);

export { env };
