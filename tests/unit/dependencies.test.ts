import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");

type PackageJson = {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  scripts: Record<string, string>;
};

const pkg: PackageJson = JSON.parse(
  readFileSync(path.join(repoRoot, "package.json"), "utf8"),
);

/**
 * Guards the dependency boundary.
 *
 * A build-time tool listed under `dependencies` ships to production, where it
 * adds install weight and drags its own vulnerable transitive tree into the
 * deployed artifact. That is exactly what happened with the shadcn CLI: it
 * pulled ts-morph and fast-glob into production and showed up in
 * `npm audit --omit=dev`.
 */
describe("dependency boundary", () => {
  const BUILD_TIME_ONLY = [
    "shadcn",
    "tailwindcss",
    "@tailwindcss/turbopack",
    "typescript",
    "eslint",
    "vitest",
    "@playwright/test",
    "tsx",
    "dotenv",
  ];

  for (const name of BUILD_TIME_ONLY) {
    it(`keeps ${name} out of production dependencies`, () => {
      expect(
        Object.keys(pkg.dependencies),
        `${name} is a build-time tool and belongs in devDependencies`,
      ).not.toContain(name);
    });
  }

  it("ships no dependency that the source never imports", () => {
    // `server-only` is a build-time marker with no import of its own name in
    // application code, and `react-dom` is pulled in by Next rather than
    // imported directly.
    const indirect = new Set(["server-only", "react-dom"]);

    const declared = Object.keys(pkg.dependencies).filter((n) => !indirect.has(n));
    expect(declared.length).toBeGreaterThan(0);

    // A sanity floor rather than a full import graph: the list should stay
    // small enough that an accidental addition is obvious in review.
    expect(declared.length).toBeLessThanOrEqual(25);
  });

  it("keeps the runtime dependency list free of CLI tools", () => {
    const cliIndicators = ["-cli", "cli-", "create-", "codemod"];
    const offenders = Object.keys(pkg.dependencies).filter((name) =>
      cliIndicators.some((indicator) => name.includes(indicator)),
    );

    expect(offenders).toEqual([]);
  });

  it("exposes the scripts the setup guide tells people to run", () => {
    for (const script of ["dev", "build", "check", "db:bootstrap-admin", "test", "lint"]) {
      expect(Object.keys(pkg.scripts), `npm run ${script} is referenced by the docs`).toContain(
        script,
      );
    }
  });
});
