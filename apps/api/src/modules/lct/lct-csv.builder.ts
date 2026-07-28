import { LctPendingAction } from '@prisma/client';
import { LctMemberSyncIntent } from './lct.types';

export const LCT_CSV_HEADERS = [
  'REQUIRED ACTION',
  'MEMBER NUMBER',
  'PRINCIPAL MEMBER NUMBER',
  'EMPLOYEE NAME',
  'STAFF NUMBER',
  'MEMBER NAME',
  'GENDER',
  'DATE OF BIRTH',
  'RELATIONSHIP',
  'EMAIL',
  'PHONE NUMBER',
  'ID NUMBER',
] as const;

export type LctCsvRow = Record<(typeof LCT_CSV_HEADERS)[number], string>;

export function intentToCsvRow(intent: LctMemberSyncIntent): LctCsvRow {
  return {
    'REQUIRED ACTION': intent.action,
    'MEMBER NUMBER': intent.memberNumber,
    'PRINCIPAL MEMBER NUMBER': intent.principalMemberNumber,
    'EMPLOYEE NAME': intent.employeeName,
    'STAFF NUMBER': intent.staffNumber,
    'MEMBER NAME': intent.memberName,
    GENDER: intent.gender,
    'DATE OF BIRTH': intent.dateOfBirth,
    RELATIONSHIP: intent.relationship,
    EMAIL: intent.email,
    'PHONE NUMBER': intent.phoneNumber,
    'ID NUMBER': intent.idNumber,
  };
}

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildLctCsv(intents: LctMemberSyncIntent[]): {
  csv: string;
  rows: LctCsvRow[];
  rowCount: number;
} {
  const rows = intents.map(intentToCsvRow);
  const lines = [
    LCT_CSV_HEADERS.join(','),
    ...rows.map((row) => LCT_CSV_HEADERS.map((h) => escapeCsvCell(row[h] ?? '')).join(',')),
  ];
  return {
    csv: lines.join('\n') + '\n',
    rows,
    rowCount: rows.length,
  };
}

export function assertValidLctAction(action: string): action is LctPendingAction {
  return (
    action === LctPendingAction.ACTIVATE ||
    action === LctPendingAction.DEACTIVATE ||
    action === LctPendingAction.SUSPENDED
  );
}
