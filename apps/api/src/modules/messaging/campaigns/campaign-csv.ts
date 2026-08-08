export interface CampaignCsvRow {
  customerName?: string | null;
  phone?: string | null;
  email?: string | null;
  customerId?: string | null;
  error: string;
}

/** Serialize preflight rows to CSV (FR-028 columns). */
export function serializeCampaignCsv(rows: CampaignCsvRow[]): string {
  const escape = (v: string | null | undefined) => {
    const s = v ?? '';
    return `"${String(s).replace(/"/g, '""')}"`;
  };
  const lines = ['customerName,phone,email,customerId,error'];
  for (const row of rows) {
    lines.push(
      [
        escape(row.customerName),
        escape(row.phone),
        escape(row.email),
        escape(row.customerId),
        escape(row.error),
      ].join(','),
    );
  }
  return `${lines.join('\n')}\n`;
}
