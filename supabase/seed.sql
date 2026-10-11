-- ============================================================================
-- Rangverse local seed — LOCAL DEVELOPMENT ONLY
--
-- This file creates *structure*, not fake business data:
--   * two teams, so reporting lines can be assigned
--   * the four starter Data Hub sheets with their column definitions
--
-- It deliberately creates NO people and NO records. Interns, managers and
-- business records must come from the real flows:
--   1. `npm run db:bootstrap-admin` creates the first administrator
--      interactively, with a password you choose.
--   2. That administrator invites everyone else from the People screen.
--
-- Never run this against production. It is safe but pointless there, and the
-- guarantee this project makes is that production is never seeded with
-- invented interns or example company records.
-- ============================================================================

insert into public.teams (name, slug, description) values
  ('Stage Crew', 'stage-crew', 'Campus events, activations and on-ground delivery'),
  ('Studio', 'studio', 'Content, shoots, edit and post-production')
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Starter Data Hub sheets.
--
-- These are categories of data Rangmanch works with. Each is created empty;
-- an administrator grants access and assigns records from the application.
-- ---------------------------------------------------------------------------

insert into public.data_sheets (title, slug, description) values
  ('Influencer Directory', 'influencer-directory', 'Creator contacts, reach and niche'),
  ('Brand Leads', 'brand-leads', 'Inbound and outbound brand conversations'),
  ('Campaign Tracker', 'campaign-tracker', 'Planned, live and wrapped campaigns'),
  ('Outreach Tracker', 'outreach-tracker', 'Who was contacted, how, and what happened')
on conflict (slug) do nothing;

insert into public.data_sheet_columns
  (sheet_id, column_key, label, data_type, is_required, display_order, options)
select s.id, c.column_key, c.label, c.data_type::public.sheet_column_type,
       c.is_required, c.display_order, c.options
from public.data_sheets s
join (values
  ('influencer-directory', 'handle',        'Handle',        'TEXT',      true,  1, '{}'::text[]),
  ('influencer-directory', 'platform',      'Platform',      'SELECT',    false, 2, array['Instagram','YouTube','X','LinkedIn']),
  ('influencer-directory', 'followers',     'Followers',     'NUMBER',    false, 3, '{}'::text[]),
  ('influencer-directory', 'niche',         'Niche',         'TEXT',      false, 4, '{}'::text[]),
  ('influencer-directory', 'city',          'City',          'TEXT',      false, 5, '{}'::text[]),
  ('influencer-directory', 'contact_email', 'Contact email', 'EMAIL',     false, 6, '{}'::text[]),
  ('influencer-directory', 'profile_url',   'Profile link',  'URL',       false, 7, '{}'::text[]),
  ('influencer-directory', 'notes',         'Notes',         'LONG_TEXT', false, 8, '{}'::text[]),

  ('brand-leads', 'brand',         'Brand',            'TEXT',      true,  1, '{}'::text[]),
  ('brand-leads', 'contact_name',  'Contact',          'TEXT',      false, 2, '{}'::text[]),
  ('brand-leads', 'contact_email', 'Contact email',    'EMAIL',     false, 3, '{}'::text[]),
  ('brand-leads', 'stage',         'Stage',            'SELECT',    false, 4, array['New','Contacted','Negotiating','Won','Lost']),
  ('brand-leads', 'deal_value',    'Indicative value', 'NUMBER',    false, 5, '{}'::text[]),
  ('brand-leads', 'next_step',     'Next step',        'TEXT',      false, 6, '{}'::text[]),
  ('brand-leads', 'notes',         'Notes',            'LONG_TEXT', false, 7, '{}'::text[]),

  ('campaign-tracker', 'campaign',     'Campaign',     'TEXT',      true,  1, '{}'::text[]),
  ('campaign-tracker', 'brand',        'Brand',        'TEXT',      false, 2, '{}'::text[]),
  ('campaign-tracker', 'status',       'Status',       'SELECT',    false, 3, array['Planned','Live','Wrapped','On hold']),
  ('campaign-tracker', 'start_date',   'Starts',       'DATE',      false, 4, '{}'::text[]),
  ('campaign-tracker', 'end_date',     'Ends',         'DATE',      false, 5, '{}'::text[]),
  ('campaign-tracker', 'deliverables', 'Deliverables', 'LONG_TEXT', false, 6, '{}'::text[]),

  ('outreach-tracker', 'target',       'Target',        'TEXT',      true,  1, '{}'::text[]),
  ('outreach-tracker', 'channel',      'Channel',       'SELECT',    false, 2, array['Email','Instagram DM','WhatsApp','Call','In person']),
  ('outreach-tracker', 'contacted_on', 'Contacted on',  'DATE',      false, 3, '{}'::text[]),
  ('outreach-tracker', 'outcome',      'Outcome',       'SELECT',    false, 4, array['No reply','Replied','Meeting booked','Declined']),
  ('outreach-tracker', 'follow_up_on', 'Follow up on',  'DATE',      false, 5, '{}'::text[]),
  ('outreach-tracker', 'notes',        'Notes',         'LONG_TEXT', false, 6, '{}'::text[])
) as c(sheet_slug, column_key, label, data_type, is_required, display_order, options)
  on c.sheet_slug = s.slug
on conflict (sheet_id, column_key) do nothing;
