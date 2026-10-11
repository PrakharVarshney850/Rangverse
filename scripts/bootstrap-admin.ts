/**
 * Creates the first Rangverse administrator.
 *
 * Run once, interactively, against a freshly migrated database:
 *
 *   npm run db:bootstrap-admin
 *
 * Security properties this script is designed around:
 *   * no credential is ever hardcoded, defaulted or committed;
 *   * the password is read from an interactive prompt with echo disabled,
 *     so it does not appear in shell history or in process arguments;
 *   * the service-role key is read from the environment and never printed;
 *   * it refuses to run if an administrator already exists, so it cannot be
 *     used to quietly add a second one later.
 */

import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true });

const MIN_PASSWORD_LENGTH = 12;

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    fail(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.\n" +
        "Copy .env.example to .env.local and fill them in first.",
    );
  }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: existing, error: lookupError } = await supabase
    .from("profiles")
    .select("email")
    .eq("role", "ADMIN")
    .limit(1);

  if (lookupError) {
    fail(
      `Could not read the profiles table: ${lookupError.message}\n` +
        "Have the migrations in supabase/migrations been applied?",
    );
  }

  if (existing && existing.length > 0) {
    fail(
      "An administrator already exists. Use the People screen in the app to invite\n" +
        "further administrators — this bootstrap script is for first-run only.",
    );
  }

  const rl = createInterface({ input: stdin, output: stdout });

  try {
    console.log("\nRangverse — first administrator setup\n");

    const email = (await rl.question("Administrator email: ")).trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      fail("That does not look like an email address.");
    }

    const fullName = (await rl.question("Full name: ")).trim();
    if (fullName.length < 2) {
      fail("Enter the administrator's full name.");
    }

    const password = await askHidden(rl, "Password (min 12 chars, mixed case + a number): ");
    const confirm = await askHidden(rl, "Confirm password: ");

    if (password !== confirm) {
      fail("The passwords did not match.");
    }

    const problem = validatePassword(password);
    if (problem) {
      fail(problem);
    }

    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (createError || !created.user) {
      fail(`Could not create the auth user: ${createError?.message ?? "unknown error"}`);
    }

    const { error: profileError } = await supabase.from("profiles").insert({
      id: created.user.id,
      email,
      full_name: fullName,
      role: "ADMIN",
      onboarding_status: "ACTIVE",
      joining_date: new Date().toISOString().slice(0, 10),
    });

    if (profileError) {
      await supabase.auth.admin.deleteUser(created.user.id);
      fail(`Could not create the profile: ${profileError.message}`);
    }

    console.log(`\n✓ Administrator created for ${email}.`);
    console.log("  Sign in at /login and invite the rest of the team from People.\n");
  } finally {
    rl.close();
  }
}

/** Reads a line without echoing it, so the password never appears on screen. */
async function askHidden(
  rl: ReturnType<typeof createInterface>,
  prompt: string,
): Promise<string> {
  const input = rl as unknown as { output?: NodeJS.WriteStream };
  const originalWrite = stdout.write.bind(stdout);
  let muted = false;

  stdout.write(prompt);

  // Suppress echo for everything typed between the prompt and the newline.
  (stdout as unknown as { write: typeof stdout.write }).write = ((
    chunk: string | Uint8Array,
    ...rest: unknown[]
  ) => {
    if (muted && typeof chunk === "string" && !chunk.includes("\n")) {
      return true;
    }
    return originalWrite(chunk as string, ...(rest as []));
  }) as typeof stdout.write;

  muted = true;
  try {
    const answer = await rl.question("");
    return answer.trim();
  } finally {
    muted = false;
    (stdout as unknown as { write: typeof stdout.write }).write = originalWrite;
    originalWrite("\n");
    void input;
  }
}

function validatePassword(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (!/[a-z]/.test(password)) return "Include a lowercase letter.";
  if (!/[A-Z]/.test(password)) return "Include an uppercase letter.";
  if (!/[0-9]/.test(password)) return "Include a number.";
  return null;
}

function fail(message: string): never {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

main().catch((error: unknown) => {
  console.error(`\n✗ ${(error as Error).message}\n`);
  process.exit(1);
});
