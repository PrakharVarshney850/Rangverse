-- ============================================================================
-- Rangverse 0007 — stamp administrator report submissions on conflict updates
--
-- The report form upserts by (user_id, report_date). When an administrator
-- submits an existing draft, the UPDATE branch must stamp submitted_at before
-- the table check constraint is evaluated.
-- ============================================================================

create or replace function app.guard_daily_report()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_temp
as $$
declare
  is_author boolean;
begin
  if tg_op = 'INSERT' then
    if not app.is_trusted_context() then
      new.user_id := coalesce(auth.uid(), new.user_id);
      new.reviewed_by := null;
      new.reviewed_at := null;
      new.manager_feedback := null;
    end if;

    new.submitted_at := case when new.status = 'SUBMITTED' then now() end;
    return new;
  end if;

  if new.user_id is distinct from old.user_id
     or new.report_date is distinct from old.report_date then
    raise exception 'A report cannot be moved to another person or date.'
      using errcode = '42501';
  end if;

  if app.is_trusted_context() or app.is_admin() then
    -- Upserts only update columns supplied by the client. For an existing
    -- draft, submitted_at is therefore still NULL here, even though the
    -- BEFORE INSERT trigger populated EXCLUDED.submitted_at. Preserve an
    -- existing submission time, or author one when the status becomes
    -- SUBMITTED, before returning through the privileged branch.
    new.submitted_at := case
      when new.status = 'SUBMITTED' then coalesce(old.submitted_at, now())
      else null
    end;
    return new;
  end if;

  is_author := old.user_id = auth.uid();

  if is_author then
    if new.reviewed_by is distinct from old.reviewed_by
       or new.reviewed_at is distinct from old.reviewed_at
       or new.manager_feedback is distinct from old.manager_feedback then
      raise exception 'Only a reviewing manager can record feedback on a report.'
        using errcode = '42501';
    end if;

    if old.status = 'SUBMITTED' then
      raise exception 'A submitted report cannot be edited. Ask an administrator to reopen it.'
        using errcode = '42501';
    end if;

    new.submitted_at := case when new.status = 'SUBMITTED' then now() end;
    return new;
  end if;

  -- Reviewing manager: feedback columns only.
  if not app.manages(old.user_id) then
    raise exception 'You cannot modify this report.' using errcode = '42501';
  end if;

  if new.status is distinct from old.status
     or new.summary is distinct from old.summary
     or new.progress is distinct from old.progress
     or new.blockers is distinct from old.blockers
     or new.next_steps is distinct from old.next_steps
     or new.evidence_links is distinct from old.evidence_links
     or new.submitted_at is distinct from old.submitted_at then
    raise exception 'A manager can only add review feedback to a report.'
      using errcode = '42501';
  end if;

  if old.status <> 'SUBMITTED' then
    raise exception 'Only submitted reports can be reviewed.' using errcode = '42501';
  end if;

  new.reviewed_by := auth.uid();
  new.reviewed_at := now();
  return new;
end;
$$;
