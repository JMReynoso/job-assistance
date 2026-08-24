"use client";

import type { JobContact } from "@/lib/job-assistance/types";
import { CONTACT_COLUMNS } from "@/lib/job-assistance/constants";

interface ContactsTableProps {
  contacts: JobContact[];
  className?: string;
}

/**
 * Read-only view of the people Hunter found for a job.
 *
 * Nothing here is editable: these rows are lookup results, owned by the
 * contacts endpoint and refreshed by re-running the lookup. Correcting one by
 * hand would be overwritten on the next run, so the table displays and does
 * not edit.
 */
export default function ContactsTable({ contacts, className }: ContactsTableProps) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-[12px] font-semibold text-muted">Contacts</label>
      <div className="overflow-x-auto rounded-[13px] border border-input-border">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[#fbf8f1]">
              {CONTACT_COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-faint"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {contacts.length === 0 ? (
              <tr>
                <td
                  colSpan={CONTACT_COLUMNS.length}
                  className="px-3 py-4 text-center text-[13px] text-placeholder"
                >
                  No contacts found for this job yet.
                </td>
              </tr>
            ) : (
              contacts.map((contact) => (
                <tr key={contact.id} className="border-t border-row-border">
                  {CONTACT_COLUMNS.map((col) => (
                    <td
                      key={col.key}
                      className="border-l border-row-border px-3 py-2.5 align-middle text-[13px] first:border-l-0"
                    >
                      {col.key === "confidence" ? (
                        <span className="tabular-nums text-muted-2">
                          {contact.confidence == null ? "—" : `${contact.confidence}%`}
                        </span>
                      ) : (
                        <span className="block min-w-[130px] break-words text-ink">
                          {contact[col.key] || <span className="text-placeholder">—</span>}
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
