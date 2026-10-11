import type { Identity } from "./test-database";
import { TestDatabase } from "./test-database";

/**
 * The seven identities the security model is specified against.
 *
 * Manager authority flows through `profiles.manager_id`, so Manager A owns
 * interns A1 and A2 and Manager B owns intern B1. Nothing links the two
 * branches, which is what the isolation tests prove.
 */
export const IDS = {
  admin: "00000000-0000-4000-8000-000000000001",
  managerA: "00000000-0000-4000-8000-000000000002",
  managerB: "00000000-0000-4000-8000-000000000003",
  internA1: "00000000-0000-4000-8000-000000000004",
  internA2: "00000000-0000-4000-8000-000000000005",
  internB1: "00000000-0000-4000-8000-000000000006",
  paused: "00000000-0000-4000-8000-000000000007",
  teamA: "00000000-0000-4000-8000-0000000000a1",
  teamB: "00000000-0000-4000-8000-0000000000a2",
  sheetInfluencers: "00000000-0000-4000-8000-0000000000b1",
  sheetBrandLeads: "00000000-0000-4000-8000-0000000000b2",
} as const;

export const ADMIN: Identity = { id: IDS.admin, email: "admin@rangverse.test" };
export const MANAGER_A: Identity = { id: IDS.managerA, email: "manager.a@rangverse.test" };
export const MANAGER_B: Identity = { id: IDS.managerB, email: "manager.b@rangverse.test" };
export const INTERN_A1: Identity = { id: IDS.internA1, email: "intern.a1@rangverse.test" };
export const INTERN_A2: Identity = { id: IDS.internA2, email: "intern.a2@rangverse.test" };
export const INTERN_B1: Identity = { id: IDS.internB1, email: "intern.b1@rangverse.test" };
export const PAUSED_INTERN: Identity = { id: IDS.paused, email: "paused@rangverse.test" };
export const ANON = null;

export interface SeededDatabase {
  db: TestDatabase;
  taskA1: string;
  taskA2: string;
  taskB1: string;
  rowAssignedA1: string;
  rowAssignedA2: string;
  rowUnassigned: string;
  rowBrandLead: string;
}

/**
 * Builds a fully populated Rangverse database. Fixtures are written as the
 * database owner (a trusted context), exactly like a server-side migration or
 * the service-role invitation flow would.
 */
export async function seedDatabase(): Promise<SeededDatabase> {
  const db = await TestDatabase.create();

  await db.execAsOwner(`
    insert into auth.users (id, email) values
      ('${IDS.admin}',    'admin@rangverse.test'),
      ('${IDS.managerA}', 'manager.a@rangverse.test'),
      ('${IDS.managerB}', 'manager.b@rangverse.test'),
      ('${IDS.internA1}', 'intern.a1@rangverse.test'),
      ('${IDS.internA2}', 'intern.a2@rangverse.test'),
      ('${IDS.internB1}', 'intern.b1@rangverse.test'),
      ('${IDS.paused}',   'paused@rangverse.test');

    insert into public.teams (id, name, slug, description) values
      ('${IDS.teamA}', 'Stage Crew', 'stage-crew', 'Campus events and activations'),
      ('${IDS.teamB}', 'Studio', 'studio', 'Content, shoots and post');

    insert into public.profiles
      (id, email, full_name, role, onboarding_status, team_id, manager_id, joining_date)
    values
      ('${IDS.admin}', 'admin@rangverse.test', 'Ambar Pandey', 'ADMIN', 'ACTIVE', null, null, '2026-01-05'),
      ('${IDS.managerA}', 'manager.a@rangverse.test', 'Manager A', 'MANAGER', 'ACTIVE', '${IDS.teamA}', null, '2026-01-05'),
      ('${IDS.managerB}', 'manager.b@rangverse.test', 'Manager B', 'MANAGER', 'ACTIVE', '${IDS.teamB}', null, '2026-01-05');

    insert into public.profiles
      (id, email, full_name, role, onboarding_status, team_id, manager_id, joining_date)
    values
      ('${IDS.internA1}', 'intern.a1@rangverse.test', 'Intern A1', 'INTERN', 'ACTIVE', '${IDS.teamA}', '${IDS.managerA}', '2026-02-01'),
      ('${IDS.internA2}', 'intern.a2@rangverse.test', 'Intern A2', 'INTERN', 'ACTIVE', '${IDS.teamA}', '${IDS.managerA}', '2026-02-01'),
      ('${IDS.internB1}', 'intern.b1@rangverse.test', 'Intern B1', 'INTERN', 'ACTIVE', '${IDS.teamB}', '${IDS.managerB}', '2026-02-01'),
      ('${IDS.paused}',   'paused@rangverse.test',   'Paused Intern', 'INTERN', 'PAUSED', '${IDS.teamA}', '${IDS.managerA}', '2026-02-01');

    insert into public.data_sheets (id, title, slug, description, created_by) values
      ('${IDS.sheetInfluencers}', 'Influencer Directory', 'influencer-directory', 'Creator contacts and reach', '${IDS.admin}'),
      ('${IDS.sheetBrandLeads}', 'Brand Leads', 'brand-leads', 'Inbound and outbound brand conversations', '${IDS.admin}');

    insert into public.data_sheet_columns (sheet_id, column_key, label, data_type, is_required, display_order) values
      ('${IDS.sheetInfluencers}', 'handle', 'Handle', 'TEXT', true, 1),
      ('${IDS.sheetInfluencers}', 'followers', 'Followers', 'NUMBER', false, 2),
      ('${IDS.sheetInfluencers}', 'contact_email', 'Contact email', 'EMAIL', false, 3),
      ('${IDS.sheetBrandLeads}', 'brand', 'Brand', 'TEXT', true, 1),
      ('${IDS.sheetBrandLeads}', 'stage', 'Stage', 'SELECT', false, 2);

    update public.data_sheet_columns
       set options = array['NEW','CONTACTED','NEGOTIATING','WON','LOST']
     where sheet_id = '${IDS.sheetBrandLeads}' and column_key = 'stage';

    insert into public.data_sheet_memberships (sheet_id, user_id, access_level, created_by) values
      ('${IDS.sheetInfluencers}', '${IDS.managerA}', 'EDIT', '${IDS.admin}'),
      ('${IDS.sheetInfluencers}', '${IDS.internA1}', 'EDIT', '${IDS.admin}'),
      ('${IDS.sheetInfluencers}', '${IDS.internA2}', 'VIEW', '${IDS.admin}');
  `);

  const [taskA1] = await db.asOwner<{ id: string }>(
    `insert into public.tasks (title, assignee_id, created_by, team_id, status, priority, due_date)
     values ('Shortlist campus creators', $1, $2, $3, 'TO_DO', 'HIGH', current_date + 3)
     returning id`,
    [IDS.internA1, IDS.managerA, IDS.teamA],
  );

  const [taskA2] = await db.asOwner<{ id: string }>(
    `insert into public.tasks (title, assignee_id, created_by, team_id)
     values ('Draft outreach copy', $1, $2, $3) returning id`,
    [IDS.internA2, IDS.managerA, IDS.teamA],
  );

  const [taskB1] = await db.asOwner<{ id: string }>(
    `insert into public.tasks (title, assignee_id, created_by, team_id)
     values ('Edit showreel cut', $1, $2, $3) returning id`,
    [IDS.internB1, IDS.managerB, IDS.teamB],
  );

  const [rowAssignedA1] = await db.asOwner<{ id: string }>(
    `insert into public.data_sheet_rows (sheet_id, assigned_to_user_id, row_data, created_by)
     values ($1, $2, '{"handle":"@creator.one","followers":"12000"}'::jsonb, $3) returning id`,
    [IDS.sheetInfluencers, IDS.internA1, IDS.admin],
  );

  const [rowAssignedA2] = await db.asOwner<{ id: string }>(
    `insert into public.data_sheet_rows (sheet_id, assigned_to_user_id, row_data, created_by)
     values ($1, $2, '{"handle":"@creator.two"}'::jsonb, $3) returning id`,
    [IDS.sheetInfluencers, IDS.internA2, IDS.admin],
  );

  const [rowUnassigned] = await db.asOwner<{ id: string }>(
    `insert into public.data_sheet_rows (sheet_id, assigned_to_user_id, row_data, created_by)
     values ($1, null, '{"handle":"@creator.three"}'::jsonb, $2) returning id`,
    [IDS.sheetInfluencers, IDS.admin],
  );

  const [rowBrandLead] = await db.asOwner<{ id: string }>(
    `insert into public.data_sheet_rows (sheet_id, assigned_to_user_id, row_data, created_by)
     values ($1, null, '{"brand":"Bentodent","stage":"CONTACTED"}'::jsonb, $2) returning id`,
    [IDS.sheetBrandLeads, IDS.admin],
  );

  return {
    db,
    taskA1: required(taskA1).id,
    taskA2: required(taskA2).id,
    taskB1: required(taskB1).id,
    rowAssignedA1: required(rowAssignedA1).id,
    rowAssignedA2: required(rowAssignedA2).id,
    rowUnassigned: required(rowUnassigned).id,
    rowBrandLead: required(rowBrandLead).id,
  };
}

function required<T>(value: T | undefined): T {
  if (value === undefined) {
    throw new Error("Fixture insert returned no row");
  }
  return value;
}
