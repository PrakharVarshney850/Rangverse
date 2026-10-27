/**
 * Setup checker — `npm run check`
 *
 * Tells you exactly how far the setup has got and what to do next, instead of
 * leaving you to guess from a blank page or a generic error.
 *
 * It only reads: it never creates, modifies or deletes anything.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true });

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

const tick = `${GREEN}✓${RESET}`;
const cross = `${RED}✗${RESET}`;
const warn = `${YELLOW}!${RESET}`;

let failed = false;

function ok(message: string) {
  console.log(`  ${tick} ${message}`);
}

function bad(message: string, fix: string) {
  failed = true;
  console.log(`  ${cross} ${message}`);
  console.log(`    ${DIM}→ ${fix}${RESET}`);
}

function note(message: string) {
  console.log(`  ${warn} ${message}`);
}

function heading(text: string) {
  console.log(`\n${BOLD}${text}${RESET}`);
}

async function main() {
  console.log(`\n${BOLD}Rangverse setup check${RESET}`);
  console.log(`${DIM}Kya ho chuka hai aur kya baaki hai${RESET}`);

  // -------------------------------------------------------------------------
  heading("1. Environment file");

  const envPath = path.resolve(".env.local");
  const strayTxt = path.resolve(".env.local.txt");

  if (existsSync(strayTxt)) {
    bad(
      ".env.local.txt mili hai (.env.local nahi)",
      "Notepad ne .txt laga diya hai. File ko rename karke .env.local karo.",
    );
  }

  if (!existsSync(envPath)) {
    bad(
      ".env.local nahi mili",
      "`.env.example` ko copy karke `.env.local` banao aur Supabase ki values daalo.",
    );
    return finish();
  }

  ok(".env.local mil gayi");

  const raw = readFileSync(envPath, "utf8");
  if (/^\s*\w+\s+=/m.test(raw)) {
    note("Kisi line me `=` ke aas-paas space hai — `KEY=value` likho, `KEY = value` nahi.");
  }
  if (/=\s*["']/.test(raw)) {
    note("Kisi value pe quotes lage hain — hata do, `KEY=abc` sahi hai.");
  }

  // -------------------------------------------------------------------------
  heading("2. Required values");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    bad("NEXT_PUBLIC_SUPABASE_URL missing", "Supabase → Project Settings → API → Project URL");
  } else if (!/^https:\/\/.+\.supabase\.(co|in)$/.test(url)) {
    bad(
      `NEXT_PUBLIC_SUPABASE_URL theek nahi lag raha: ${url}`,
      "https:// se shuru aur .supabase.co pe khatam hona chahiye.",
    );
  } else {
    ok(`Supabase URL: ${url}`);
  }

  if (!anon) {
    bad("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY missing", "Supabase → Settings → API → anon key");
  } else if (anon.length < 30) {
    bad("anon key chhoti lag rahi hai", "Poori key copy karo, kat na jaye.");
  } else {
    ok("anon key mil gayi");
  }

  if (!service) {
    bad(
      "SUPABASE_SERVICE_ROLE_KEY missing",
      "Supabase → Settings → API → service_role (Reveal dabana padega)",
    );
  } else if (service === anon) {
    bad(
      "service_role aur anon key ek hi hain",
      "Dono alag hoti hain. service_role chhupi hoti hai — 'Reveal' dabao.",
    );
  } else {
    ok("service_role key mil gayi");
  }

  if (!site) {
    bad("NEXT_PUBLIC_SITE_URL missing", "Local ke liye http://localhost:3000 daalo.");
  } else {
    ok(`Site URL: ${site}`);
    if (!site.startsWith("http://localhost") && site.includes("vercel.app")) {
      note("Deployed URL set hai — local pe chalana ho to http://localhost:3000 karo.");
    }
  }

  if (!url || !anon || !service) {
    return finish();
  }

  // -------------------------------------------------------------------------
  heading("3. Supabase se connection");

  const admin = createClient(url, service, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const { error } = await admin.from("profiles").select("id").limit(1);

    if (error) {
      if (/fetch failed|network|ENOTFOUND|ECONNREFUSED|EAI_AGAIN|timeout/i.test(error.message)) {
        bad(
          "Supabase tak pahunch nahi paya",
          "Do me se ek baat hai: (a) internet band hai, ya (b) NEXT_PUBLIC_SUPABASE_URL galat hai. URL ko browser me kholke dekho — kuch khulna chahiye.",
        );
        return finish();
      }
      if (/does not exist|schema cache|relation/i.test(error.message)) {
        bad(
          "Connection to ho gaya, lekin tables nahi mile",
          "Migrations nahi chalayi. supabase/migrations ki 7 files SQL Editor me 0001 se 0007 ke order me chalao.",
        );
        return finish();
      }
      if (/Invalid API key|JWT|apikey/i.test(error.message)) {
        bad(
          "Key reject ho gayi",
          "service_role key galat hai ya kat gayi hai. Supabase → Settings → API se dobara poori copy karo.",
        );
        return finish();
      }
      bad(`Database ne error diya: ${error.message}`, "Message dhyan se padho, usme clue hoga.");
      return finish();
    }

    ok("Supabase tak pahunch ho gayi");
  } catch (error) {
    const message = (error as Error).message;
    if (/fetch failed|network|ENOTFOUND|ECONNREFUSED|EAI_AGAIN/i.test(message)) {
      bad(
        "Supabase tak pahunch nahi paya",
        "Internet band hai, ya NEXT_PUBLIC_SUPABASE_URL galat hai. URL browser me kholke check karo.",
      );
    } else {
      bad(`Connection fail: ${message}`, "URL aur keys dobara check karo.");
    }
    return finish();
  }

  // -------------------------------------------------------------------------
  heading("4. Tables");

  const expected = [
    "teams",
    "profiles",
    "activity_logs",
    "attendance_sessions",
    "breaks",
    "tasks",
    "task_comments",
    "task_time_entries",
    "daily_work_reports",
    "daily_report_tasks",
    "data_sheets",
    "data_sheet_columns",
    "data_sheet_memberships",
    "data_sheet_rows",
  ];

  const missing: string[] = [];
  for (const table of expected) {
    const { error } = await admin.from(table).select("*").limit(0);
    if (error) missing.push(table);
  }

  if (missing.length === 0) {
    ok(`Saari ${expected.length} tables mil gayin`);
  } else {
    bad(
      `${missing.length} tables missing: ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? "…" : ""}`,
      "Migrations adhoori hain. 0001 se 0007 tak, order me dobara chalao.",
    );
    return finish();
  }

  // -------------------------------------------------------------------------
  heading("5. Administrator");

  const { data: admins, error: adminError } = await admin
    .from("profiles")
    .select("email")
    .eq("role", "ADMIN");

  if (adminError) {
    bad(`Admin check fail: ${adminError.message}`, "Upar wale steps dobara dekho.");
  } else if (!admins || admins.length === 0) {
    bad(
      "Koi administrator nahi bana",
      "`npm run db:bootstrap-admin` chalao. Password type karte waqt screen pe kuch nahi dikhega — normal hai.",
    );
  } else {
    ok(`Administrator maujood hai: ${admins.map((a) => a.email).join(", ")}`);
  }

  // -------------------------------------------------------------------------
  heading("6. Login settings");

  note("Ye khud check karo — API se nahi pata chalta:");
  console.log(
    `    ${DIM}Supabase → Authentication → Sign In / Providers →${RESET}`,
  );
  console.log(
    `    ${DIM}"Allow new users to sign up" ${BOLD}OFF${RESET}${DIM} hona chahiye${RESET}`,
  );
  console.log(
    `    ${DIM}(ON chhoda to internet pe koi bhi khud account bana lega)${RESET}`,
  );

  finish();
}

function finish() {
  console.log("");
  if (failed) {
    console.log(`${RED}${BOLD}Kuch baaki hai.${RESET} Upar ke → wale steps follow karo.`);
    console.log(`${DIM}Poori guide: docs/SETUP-GUIDE-HINDI.md${RESET}\n`);
    process.exit(1);
  }

  console.log(`${GREEN}${BOLD}Sab theek hai!${RESET}`);
  console.log(`${DIM}Ab chalao: npm run dev → http://localhost:3000${RESET}\n`);
}

main().catch((error: unknown) => {
  console.error(`\n${RED}Check fail ho gaya:${RESET} ${(error as Error).message}\n`);
  process.exit(1);
});
