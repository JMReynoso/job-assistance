"use client";

import type { JobContact } from "@/lib/job-assistance/types";
import { CONTACT_COLUMNS, emptyContact } from "@/lib/job-assistance/constants";

interface ContactsTableProps {
  contacts: JobContact[];
  onChange: (contacts: JobContact[]) => void;
  className?: string;
}

function createContactId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `contact-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function ContactsTable({ contacts, onChange, className }: ContactsTableProps) {
  function updateCell(id: string, key: keyof Omit<JobContact, "id">, value: string) {
    onChange(contacts.map((c) => (c.id === id ? { ...c, [key]: value } : c)));
  }

  function addContact() {
    onChange([...contacts, emptyContact(createContactId())]);
  }

  function removeContact(id: string) {
    onChange(contacts.filter((c) => c.id !== id));
  }

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
              <th className="w-9 border-l border-table-border" aria-hidden />
            </tr>
          </thead>
          <tbody>
            {contacts.length === 0 ? (
              <tr>
                <td
                  colSpan={CONTACT_COLUMNS.length + 1}
                  className="px-3 py-4 text-center text-[13px] text-placeholder"
                >
                  No contacts yet — add one below.
                </td>
              </tr>
            ) : (
              contacts.map((contact) => (
                <tr key={contact.id} className="border-t border-row-border">
                  {CONTACT_COLUMNS.map((col) => (
                    <td key={col.key} className="border-l border-row-border p-0 first:border-l-0">
                      <input
                        type={col.type ?? "text"}
                        value={contact[col.key]}
                        onChange={(e) => updateCell(contact.id, col.key, e.target.value)}
                        placeholder={col.placeholder}
                        className="w-full min-w-[130px] border-0 bg-transparent px-3 py-2.5 text-[13px] text-ink outline-none focus:bg-white focus:ring-1 focus:ring-inset focus:ring-sage"
                      />
                    </td>
                  ))}
                  <td className="border-l border-row-border p-0 text-center align-middle">
                    <button
                      type="button"
                      onClick={() => removeContact(contact.id)}
                      aria-label={`Remove ${contact.name.trim() || "contact"}`}
                      className="h-[30px] w-[30px] rounded-lg text-[15px] leading-none text-muted-2 hover:bg-[#f3ddd7] hover:text-[#a8503b]"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        onClick={addContact}
        className="mt-2 inline-flex items-center gap-1.5 rounded-[10px] border border-input-border bg-white px-3 py-1.5 text-[13px] font-semibold text-[#5f7a3a] hover:bg-[#f5f8ee]"
      >
        <span className="text-[16px] leading-none">＋</span> Add contact
      </button>
    </div>
  );
}
