import type { SheetColumnType } from "@/lib/db/database.types";

export type TemplateColumn = {
  column_key: string;
  label: string;
  data_type: SheetColumnType;
  is_required?: boolean;
  options?: string[];
};

/**
 * Column presets offered when creating a sheet.
 *
 * These are categories of business data Rangmanch works with — not a claim
 * that any particular records exist. A new sheet starts empty.
 */
export const SHEET_TEMPLATES: Record<
  string,
  { label: string; columns: readonly TemplateColumn[] }
> = {
  BLANK: { label: "Blank sheet", columns: [] },
  INFLUENCER_DIRECTORY: {
    label: "Influencer Directory",
    columns: [
      { column_key: "handle", label: "Handle", data_type: "TEXT", is_required: true },
      {
        column_key: "platform",
        label: "Platform",
        data_type: "SELECT",
        options: ["Instagram", "YouTube", "X", "LinkedIn"],
      },
      { column_key: "followers", label: "Followers", data_type: "NUMBER" },
      { column_key: "niche", label: "Niche", data_type: "TEXT" },
      { column_key: "city", label: "City", data_type: "TEXT" },
      { column_key: "contact_email", label: "Contact email", data_type: "EMAIL" },
      { column_key: "profile_url", label: "Profile link", data_type: "URL" },
      { column_key: "notes", label: "Notes", data_type: "LONG_TEXT" },
    ],
  },
  BRAND_LEADS: {
    label: "Brand Leads",
    columns: [
      { column_key: "brand", label: "Brand", data_type: "TEXT", is_required: true },
      { column_key: "contact_name", label: "Contact", data_type: "TEXT" },
      { column_key: "contact_email", label: "Contact email", data_type: "EMAIL" },
      {
        column_key: "stage",
        label: "Stage",
        data_type: "SELECT",
        options: ["New", "Contacted", "Negotiating", "Won", "Lost"],
      },
      { column_key: "deal_value", label: "Indicative value", data_type: "NUMBER" },
      { column_key: "next_step", label: "Next step", data_type: "TEXT" },
      { column_key: "notes", label: "Notes", data_type: "LONG_TEXT" },
    ],
  },
  CAMPAIGN_TRACKER: {
    label: "Campaign Tracker",
    columns: [
      { column_key: "campaign", label: "Campaign", data_type: "TEXT", is_required: true },
      { column_key: "brand", label: "Brand", data_type: "TEXT" },
      {
        column_key: "status",
        label: "Status",
        data_type: "SELECT",
        options: ["Planned", "Live", "Wrapped", "On hold"],
      },
      { column_key: "start_date", label: "Starts", data_type: "DATE" },
      { column_key: "end_date", label: "Ends", data_type: "DATE" },
      { column_key: "deliverables", label: "Deliverables", data_type: "LONG_TEXT" },
    ],
  },
  OUTREACH_TRACKER: {
    label: "Outreach Tracker",
    columns: [
      { column_key: "target", label: "Target", data_type: "TEXT", is_required: true },
      {
        column_key: "channel",
        label: "Channel",
        data_type: "SELECT",
        options: ["Email", "Instagram DM", "WhatsApp", "Call", "In person"],
      },
      { column_key: "contacted_on", label: "Contacted on", data_type: "DATE" },
      {
        column_key: "outcome",
        label: "Outcome",
        data_type: "SELECT",
        options: ["No reply", "Replied", "Meeting booked", "Declined"],
      },
      { column_key: "follow_up_on", label: "Follow up on", data_type: "DATE" },
      { column_key: "notes", label: "Notes", data_type: "LONG_TEXT" },
    ],
  },
};

export type SheetTemplateKey = keyof typeof SHEET_TEMPLATES;
