/// <reference types="multer" />
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseService } from './supabase.service';
import { MpesaStatementReasonType } from '@prisma/client';
import * as XLSX from 'xlsx';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { ValidationException } from '../exceptions/validation.exception';
import { ErrorCodes } from '../enums/error-codes.enum';

interface ExcelHeaderData {
  accountHolder: string;
  shortCode?: string;
  account?: string;
  timeFrom: Date;
  timeTo: Date;
  operator?: string;
  reportDate?: Date;
  openingBalance?: number;
  closingBalance?: number;
  availableBalance?: number;
  totalPaidIn?: number;
  totalWithdrawn?: number;
}

interface ExcelTransactionRow {
  transactionReference: string;
  completionTime: Date;
  initiationTime: Date;
  paymentDetails?: string;
  transactionStatus?: string;
  paidIn: number;
  withdrawn: number;
  accountBalance: number;
  balanceConfirmed?: string;
  reasonType: string;
  otherPartyInfo?: string;
  linkedTransactionId?: string;
  accountNumber?: string;
}

type WorksheetCell = string | number | Date | null;
type WorksheetRow = WorksheetCell[];

/**
 * MPESA Payments Service
 *
 * Handles MPESA payment statement uploads, Excel parsing, and database operations
 */
@Injectable()
export class MpesaPaymentsService {
  private readonly logger = new Logger(MpesaPaymentsService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly supabaseService: SupabaseService,
  ) {}

  /**
   * Determine if we should use Supabase Storage based on environment
   */
  private shouldUseSupabaseStorage(): boolean {
    const nodeEnv = process.env.NODE_ENV;
    return nodeEnv === 'staging' || nodeEnv === 'production';
  }

  /**
   * Store file in appropriate storage (Supabase Storage or local filesystem)
   */
  async storeFile(
    file: Express.Multer.File,
    userId: string,
    correlationId: string
  ): Promise<string> {
    this.logger.log(`[${correlationId}] Storing file: ${file.originalname}`);

    const timestamp = Date.now();
    const fileExtension = file.originalname.split('.').pop()?.toLowerCase() ?? 'xlsx';
    const baseFileName = file.originalname.replace(/\.[^/.]+$/, ''); // Remove extension
    const timestampedFileName = `${baseFileName}_${timestamp}.${fileExtension}`;

    if (this.shouldUseSupabaseStorage()) {
      // Use Supabase Storage for staging/production
      const supabase = this.supabaseService.getClient();
      const storagePath = `statements/${userId}/${timestampedFileName}`;

      const { error: uploadError } = await supabase.storage
        .from('mpesa_statements')
        .upload(storagePath, file.buffer, {
          contentType:
            file.mimetype ?? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          upsert: false, // Don't overwrite - we've already added timestamp
        });

      if (uploadError) {
        this.logger.error(`[${correlationId}] Supabase Storage upload error: ${uploadError.message}`);
        throw new BadRequestException(`Failed to upload to storage: ${uploadError.message}`);
      }

      this.logger.log(`[${correlationId}] File stored in Supabase Storage: ${storagePath}`);
      return storagePath; // Return the storage path
    } else {
      // Use filesystem storage for development
      const directoryPath = join(process.cwd(), 'public', 'mpesa_statements', userId);

      // Create directory if it doesn't exist
      if (!existsSync(directoryPath)) {
        await mkdir(directoryPath, { recursive: true });
      }

      const filePath = join(directoryPath, timestampedFileName);
      await writeFile(filePath, file.buffer);

      this.logger.log(`[${correlationId}] File stored locally: ${filePath}`);
      return `mpesa_statements/${userId}/${timestampedFileName}`; // Return relative path
    }
  }

  /**
   * Convert worksheet cell value to string
   */
  private cellToString(value: WorksheetCell | undefined): string | undefined {
    if (value === null || value === undefined) {
      return undefined;
    }

    return String(value);
  }

  /**
   * Convert worksheet cell value to a trimmed string, returning undefined for empty result
   */
  private cellToTrimmedString(value: WorksheetCell | undefined): string | undefined {
    const raw = this.cellToString(value);
    if (raw === undefined) {
      return undefined;
    }

    const trimmed = raw.trim();
    return trimmed === '' ? undefined : trimmed;
  }

  /**
   * Map Excel reason type to enum value
   */
  private mapReasonType(reasonType: string): MpesaStatementReasonType {
    const normalized = reasonType.trim();

    if (normalized === 'Pay Utility') return MpesaStatementReasonType.PayBill_STK;
    if (normalized === 'Standing Order Pay Bill') return MpesaStatementReasonType.Ratiba;
    if (normalized === 'Pay Bill Online') return MpesaStatementReasonType.Paybill_MobileApp;
    if (normalized === 'Pay Utility with OD via STK') return MpesaStatementReasonType.PayBill_Fuliza_STK;
    if (normalized === 'Pay Utility with OD Online') return MpesaStatementReasonType.PayBill_Fuliza_Online;
    if (normalized === 'Utility Account to Organization Settlement Account') return MpesaStatementReasonType.Withdrawal;

    return MpesaStatementReasonType.Unmapped;
  }

  /**
   * Find value next to a label in a row using label matching
   */
  private findValueByLabel(rows: WorksheetRow[], rowIndex: number, label: string): string | null {
    const row = rows[rowIndex];
    if (!row) {
      return null;
    }

    for (let col = 0; col < row.length; col++) {
      const cellValue = this.cellToString(row[col]);
      if (cellValue?.trim() === label && col + 1 < row.length) {
        return this.cellToTrimmedString(row[col + 1]) ?? null;
      }
    }
    return null;
  }

  /**
   * Parse Excel file and extract header data and transactions
   */
  async parseExcelFile(buffer: Buffer, correlationId: string): Promise<{
    header: ExcelHeaderData;
    transactions: ExcelTransactionRow[];
  }> {
    this.logger.log(`[${correlationId}] Parsing Excel file`);

    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // Convert to JSON for easier parsing
      // Use raw: true to get raw cell values (numbers for dates, which we'll convert)
      // This gives us more control over date parsing
      const rows = XLSX.utils.sheet_to_json<WorksheetRow>(worksheet, {
        header: 1,
        defval: null,
        raw: true // Get raw values - dates will be Excel serial numbers or Date objects
      });

      // Parse header rows (1-6, 0-indexed: 0-5)
      // Row 4 format: "Time Period: From 10-10-2025 00:00:00 To 13-10-2025 23:59:59"
      // Dates are in columns C and E (indices 2 and 4), but may contain "From" and "To" prefixes
      const timeFromStr = this.cellToString(rows[3]?.[2]) ?? '';
      const timeToStr = this.cellToString(rows[3]?.[4]) ?? '';

      // Extract date from string, removing "From" and "To" prefixes if present
      const timeFromClean = timeFromStr.replace(/^From\s+/i, '').trim();
      const timeToClean = timeToStr.replace(/^To\s+/i, '').trim();

      const header: ExcelHeaderData = {
        accountHolder: this.cellToString(rows[0]?.[1]) ?? '', // Row 1, Column B
        shortCode: this.cellToTrimmedString(rows[1]?.[1]), // Row 2, Column B
        account: this.cellToTrimmedString(rows[2]?.[1]), // Row 3, Column B
        timeFrom: this.parseDateTime(timeFromClean), // Row 4, Column C
        timeTo: this.parseDateTime(timeToClean), // Row 4, Column E
        operator: this.cellToTrimmedString(rows[4]?.[1]), // Row 5, Column B
      };

      // Parse Date of Report from Row 5, Column F (index 5)
      // Row 5 format: "Operator: jponyango Date of Report: 13-10-2025 12:36:39"
      const row5Text = (rows[4] ?? [])
        .map((cell) => this.cellToString(cell) ?? '')
        .join(' '); // Join all cells in row 5 to search for date
      const reportDateMatch = row5Text.match(/Date of Report:\s*(\d{2}-\d{2}-\d{4}\s+\d{2}:\d{2}:\d{2})/i);
      if (reportDateMatch) {
        header.reportDate = this.parseDateTime(reportDateMatch[1]);
      } else {
        // Fallback: try to parse from column F directly if it contains a date
        const reportDateStr = this.cellToString(rows[4]?.[5]);
        if (reportDateStr) {
          const parsedDate = this.parseDateTime(reportDateStr);
          // Only use if it's a valid date (not the fallback current date)
          if (parsedDate && parsedDate.getTime() !== new Date().getTime()) {
            header.reportDate = parsedDate;
          }
        }
      }

      // Parse row 6 values directly from specific columns (0-indexed row 5)
      // Row 6 format: Opening Balance: X Closing Balance: Y Available Balance: Z Total Paid In: A Total Withdrawn: B
      // Values are in columns B, D, F, H, J (indices 1, 3, 5, 7, 9) based on user's description
      const row6 = rows[5] ?? [];

      // First try direct column access (primary method based on user feedback)
      // Then fallback to label matching if direct access doesn't work
      let openingBalanceStr = this.cellToTrimmedString(row6[1]);
      let closingBalanceStr = this.cellToTrimmedString(row6[3]);
      let availableBalanceStr = this.cellToTrimmedString(row6[5]);
      let totalPaidInStr = this.cellToTrimmedString(row6[7]);
      let totalWithdrawnStr = this.cellToTrimmedString(row6[9]);

      // Fallback to label matching if direct access didn't yield values
      openingBalanceStr ??= this.findValueByLabel(rows, 5, 'Opening Balance') ?? undefined;
      closingBalanceStr ??= this.findValueByLabel(rows, 5, 'Closing Balance') ?? undefined;
      availableBalanceStr ??= this.findValueByLabel(rows, 5, 'Available Balance') ?? undefined;
      totalPaidInStr ??= this.findValueByLabel(rows, 5, 'Total Paid In') ?? undefined;
      totalWithdrawnStr ??= this.findValueByLabel(rows, 5, 'Total Withdrawn') ?? undefined;

      header.openingBalance = openingBalanceStr ? this.parseDecimal(openingBalanceStr) : undefined;
      header.closingBalance = closingBalanceStr ? this.parseDecimal(closingBalanceStr) : undefined;
      header.availableBalance = availableBalanceStr ? this.parseDecimal(availableBalanceStr) : undefined;
      header.totalPaidIn = totalPaidInStr ? this.parseDecimal(totalPaidInStr) : undefined;
      header.totalWithdrawn = totalWithdrawnStr ? this.parseDecimal(totalWithdrawnStr) : undefined;

      // Parse transaction rows (row 7+, 0-indexed: 6+)
      // First, find the header row (should be row 7, index 6)
      let headerRowIndex = 6; // Default to row 7
      const transactions: ExcelTransactionRow[] = [];

      // Find the actual header row by looking for "Receipt No." in column A
      for (let i = 6; i < Math.min(10, rows.length); i++) {
        if (rows[i]?.[0]?.toString()?.trim() === 'Receipt No.') {
          headerRowIndex = i;
          break;
        }
      }

      // Parse transactions starting from the row after the header
      for (let i = headerRowIndex + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row) continue; // Skip empty rows

        const transactionReference = this.cellToTrimmedString(row[0]);
        if (!transactionReference) continue; // Skip rows without receipt number

        // Parse dates - handle Date objects, numbers (Excel serial), or strings
        const completionTimeValue = row[1];
        const initiationTimeValue = row[2];

        const transaction: ExcelTransactionRow = {
          transactionReference,
          completionTime: this.parseDateTime(completionTimeValue ?? ''), // Column B
          initiationTime: this.parseDateTime(initiationTimeValue ?? ''), // Column C
          paymentDetails: this.cellToTrimmedString(row[3]), // Column D
          transactionStatus: this.cellToTrimmedString(row[4]), // Column E
          paidIn: this.parseDecimal(this.cellToString(row[5])), // Column F
          withdrawn: this.parseDecimal(this.cellToString(row[6])), // Column G
          accountBalance: this.parseDecimal(this.cellToString(row[7])), // Column H
          balanceConfirmed: this.cellToTrimmedString(row[8]), // Column I
          reasonType: this.cellToTrimmedString(row[9]) ?? 'Unmapped', // Column J
          otherPartyInfo: this.cellToTrimmedString(row[10]), // Column K
          linkedTransactionId: this.cellToTrimmedString(row[11]), // Column L
          accountNumber: this.cellToTrimmedString(row[12]), // Column M
        };

        transactions.push(transaction);
      }

      // Validate that we have the required header data
      if (!header.accountHolder || header.accountHolder.trim() === '') {
        throw new ValidationException(
          ErrorCodes.INVALID_FORMAT,
          'The Excel file does not meet the required format. Missing Account Holder information in row 1, column B.'
        );
      }

      if (!header.timeFrom || !header.timeTo || isNaN(header.timeFrom.getTime()) || isNaN(header.timeTo.getTime())) {
        throw new ValidationException(
          ErrorCodes.INVALID_FORMAT,
          'The Excel file does not meet the required format. Missing or invalid Time From/Time To information in row 4.'
        );
      }

      this.logger.log(`[${correlationId}] Parsed ${transactions.length} transactions from Excel file`);

      return { header, transactions };
    } catch (error) {
      this.logger.error(
        `[${correlationId}] Error parsing Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined
      );

      // If it's already a ValidationException, re-throw it
      if (error instanceof ValidationException) {
        throw error;
      }

      // Check for common Excel parsing errors
      if (error instanceof Error) {
        if (error.message.includes('Cannot read') || error.message.includes('Unexpected')) {
          throw new ValidationException(
            ErrorCodes.INVALID_FORMAT,
            'The Excel file does not meet the required format. Please ensure the file is a valid MPESA statement with the correct structure (rows 1-6 contain header information, row 7+ contains transactions).'
          );
        }

        if (error.message.includes('corrupt') || error.message.includes('invalid')) {
          throw new ValidationException(
            ErrorCodes.INVALID_FORMAT,
            'The Excel file appears to be corrupted or invalid. Please ensure you are uploading a valid .xls or .xlsx file downloaded from the MPESA portal.'
          );
        }
      }

      // Generic parsing error
      throw new ValidationException(
        ErrorCodes.INVALID_FORMAT,
        'The Excel file does not meet the required format requirements. Please ensure the file is a valid MPESA statement downloaded from the MPESA portal with the correct structure.'
      );
    }
  }

  /**
   * Parse decimal value from string (handles commas and currency symbols)
   */
  private parseDecimal(value: string | undefined): number {
    if (!value) return 0;
    // Remove commas, currency symbols, and whitespace
    const cleaned = value.toString().replace(/[,\s$KES]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }

  /**
   * Parse datetime from string or Date object (handles various formats)
   * IMPORTANT: We use DD-MM-YYYY format (not MM-DD-YYYY)
   */
  private parseDateTime(value: string | Date | number): Date {
    // Handle Date objects directly
    if (value instanceof Date) {
      return value;
    }

    // Handle numbers (Excel date serial numbers)
    if (typeof value === 'number') {
      if (value > 0 && value < 100000) {
        // Excel dates are days since 1900-01-01
        const excelEpoch = new Date(1899, 11, 30);
        return new Date(excelEpoch.getTime() + value * 86400000);
      }
      // If it's a timestamp (milliseconds since epoch), use it directly
      if (value > 1000000000000) {
        return new Date(value);
      }
    }

    if (!value || (typeof value === 'string' && value.trim() === '')) {
      return new Date();
    }

    const trimmed = typeof value === 'string' ? value.trim() : String(value).trim();

    // Try parsing as Excel date number (if it's a string that looks like a number)
    const excelDate = parseFloat(trimmed);
    if (!isNaN(excelDate) && excelDate > 0 && excelDate < 100000 && trimmed.match(/^\d+(\.\d+)?$/)) {
      // Excel dates are days since 1900-01-01
      const excelEpoch = new Date(1899, 11, 30);
      return new Date(excelEpoch.getTime() + excelDate * 86400000);
    }

    // Try DD-MM-YYYY format FIRST (this is our primary format)
    // Format: DD-MM-YYYY HH:MM:SS or DD-MM-YYYY
    const ddMmYyyyMatch = trimmed.match(/^(\d{2})-(\d{2})-(\d{4})(?:\s+(\d{2}):(\d{2}):(\d{2}))?$/);
    if (ddMmYyyyMatch) {
      const day = parseInt(ddMmYyyyMatch[1], 10);
      const month = parseInt(ddMmYyyyMatch[2], 10);
      const year = parseInt(ddMmYyyyMatch[3], 10);
      const hours = ddMmYyyyMatch[4] ? parseInt(ddMmYyyyMatch[4], 10) : 0;
      const minutes = ddMmYyyyMatch[5] ? parseInt(ddMmYyyyMatch[5], 10) : 0;
      const seconds = ddMmYyyyMatch[6] ? parseInt(ddMmYyyyMatch[6], 10) : 0;

      // Validate date (day should be 1-31, month should be 1-12)
      if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
        return new Date(year, month - 1, day, hours, minutes, seconds);
      }
    }

    // Try YYYY-MM-DD format (ISO format)
    const yyyyMmDdMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2}):(\d{2}))?$/);
    if (yyyyMmDdMatch) {
      const year = parseInt(yyyyMmDdMatch[1], 10);
      const month = parseInt(yyyyMmDdMatch[2], 10);
      const day = parseInt(yyyyMmDdMatch[3], 10);
      const hours = yyyyMmDdMatch[4] ? parseInt(yyyyMmDdMatch[4], 10) : 0;
      const minutes = yyyyMmDdMatch[5] ? parseInt(yyyyMmDdMatch[5], 10) : 0;
      const seconds = yyyyMmDdMatch[6] ? parseInt(yyyyMmDdMatch[6], 10) : 0;

      return new Date(year, month - 1, day, hours, minutes, seconds);
    }

    // Try ISO string format (only if it's clearly an ISO format to avoid MM-DD-YYYY misinterpretation)
    if (trimmed.includes('T') || trimmed.match(/^\d{4}-\d{2}-\d{2}T/)) {
      const isoDate = new Date(trimmed);
      if (!isNaN(isoDate.getTime())) {
        return isoDate;
      }
    }

    // Fallback: log warning and return current date
    this.logger.warn(`Could not parse date: "${value}" (type: ${typeof value})`);
    return new Date();
  }

  /**
   * Upload and parse MPESA statement file
   */
  async uploadAndParseStatement(
    file: Express.Multer.File,
    userId: string,
    correlationId: string
  ) {
    this.logger.log(`[${correlationId}] Uploading and parsing MPESA statement: ${file.originalname}`);

    // Validate file type
    const allowedMimeTypes = [
      'application/vnd.ms-excel', // .xls
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    ];
    const allowedExtensions = ['.xls', '.xlsx'];

    const fileExtension = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
    if (!allowedExtensions.includes(fileExtension) && !allowedMimeTypes.includes(file.mimetype)) {
      throw new ValidationException(
        ErrorCodes.INVALID_FORMAT,
        'Invalid file type. Only .xls and .xlsx files are allowed. Please upload a valid MPESA statement file.'
      );
    }

    // Parse Excel file FIRST to validate it before storing
    // This way we don't store invalid/corrupted files
    const { header, transactions } = await this.parseExcelFile(file.buffer, correlationId);

    // Store file only after successful parsing
    const filePath = await this.storeFile(file, userId, correlationId);

    // Save to database
    const upload = await this.prismaService.mpesaPaymentReportUpload.create({
      data: {
        accountHolder: header.accountHolder,
        shortCode: header.shortCode,
        account: header.account,
        timeFrom: header.timeFrom,
        timeTo: header.timeTo,
        operator: header.operator,
        reportDate: header.reportDate,
        openingBalance: header.openingBalance,
        closingBalance: header.closingBalance,
        availableBalance: header.availableBalance,
        totalPaidIn: header.totalPaidIn,
        totalWithdrawn: header.totalWithdrawn,
        filePath,
        createdBy: userId,
        items: {
          create: transactions.map((t) => ({
            transactionReference: t.transactionReference,
            completionTime: t.completionTime,
            initiationTime: t.initiationTime,
            paymentDetails: t.paymentDetails,
            transactionStatus: t.transactionStatus,
            paidIn: t.paidIn,
            withdrawn: t.withdrawn,
            accountBalance: t.accountBalance,
            balanceConfirmed: t.balanceConfirmed,
            reasonType: this.mapReasonType(t.reasonType),
            otherPartyInfo: t.otherPartyInfo,
            linkedTransactionId: t.linkedTransactionId,
            accountNumber: t.accountNumber,
          })),
        },
      },
      include: {
        _count: {
          select: {
            items: true,
          },
        },
      },
    });

    this.logger.log(`[${correlationId}] Created upload with ${upload._count.items} items`);

    return {
      upload: {
        id: upload.id,
        accountHolder: upload.accountHolder,
        shortCode: upload.shortCode ?? undefined,
        account: upload.account ?? undefined,
        timeFrom: upload.timeFrom,
        timeTo: upload.timeTo,
        operator: upload.operator ?? undefined,
        reportDate: upload.reportDate ?? undefined,
        openingBalance: upload.openingBalance ? Number(upload.openingBalance) : undefined,
        closingBalance: upload.closingBalance ? Number(upload.closingBalance) : undefined,
        availableBalance: upload.availableBalance ? Number(upload.availableBalance) : undefined,
        totalPaidIn: upload.totalPaidIn ? Number(upload.totalPaidIn) : undefined,
        totalWithdrawn: upload.totalWithdrawn ? Number(upload.totalWithdrawn) : undefined,
        filePath: upload.filePath ?? undefined,
        createdBy: upload.createdBy ?? undefined,
        createdAt: upload.createdAt,
        updatedAt: upload.updatedAt,
      },
      itemsCount: upload._count.items,
    };
  }

  /**
   * Get list of uploads with pagination
   */
  async getUploads(page: number = 1, pageSize: number = 20, correlationId: string) {
    this.logger.log(`[${correlationId}] Getting uploads, page ${page}, pageSize ${pageSize}`);

    try {
      const validatedPage = Math.max(1, page);
      const validatedPageSize = Math.min(100, Math.max(1, pageSize));
      const skip = (validatedPage - 1) * validatedPageSize;

      const [uploads, totalCount] = await Promise.all([
        this.prismaService.mpesaPaymentReportUpload.findMany({
          skip,
          take: validatedPageSize,
          orderBy: {
            createdAt: 'desc',
          },
        }),
        this.prismaService.mpesaPaymentReportUpload.count(),
      ]);

      const totalPages = Math.ceil(totalCount / validatedPageSize);

      const uploadsDto = uploads.map((u) => ({
        id: u.id,
        accountHolder: u.accountHolder,
        shortCode: u.shortCode ?? undefined,
        account: u.account ?? undefined,
        timeFrom: u.timeFrom,
        timeTo: u.timeTo,
        operator: u.operator ?? undefined,
        reportDate: u.reportDate ?? undefined,
        openingBalance: u.openingBalance ? Number(u.openingBalance) : undefined,
        closingBalance: u.closingBalance ? Number(u.closingBalance) : undefined,
        availableBalance: u.availableBalance ? Number(u.availableBalance) : undefined,
        totalPaidIn: u.totalPaidIn ? Number(u.totalPaidIn) : undefined,
        totalWithdrawn: u.totalWithdrawn ? Number(u.totalWithdrawn) : undefined,
        filePath: u.filePath ?? undefined,
        createdBy: u.createdBy ?? undefined,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
      }));

      return {
        data: uploadsDto,
        pagination: {
          page: validatedPage,
          pageSize: validatedPageSize,
          totalItems: totalCount,
          totalPages,
          hasNextPage: validatedPage < totalPages,
          hasPreviousPage: validatedPage > 1,
        },
      };
    } catch (error) {
      this.logger.error(
        `[${correlationId}] Error getting uploads: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined
      );
      throw error;
    }
  }

  /**
   * Get upload details with transaction items
   */
  async getUploadDetails(
    uploadId: string,
    page: number = 1,
    pageSize: number = 20,
    correlationId: string
  ) {
    this.logger.log(`[${correlationId}] Getting upload details: ${uploadId}`);

    try {
      const upload = await this.prismaService.mpesaPaymentReportUpload.findUnique({
        where: { id: uploadId },
      });

      if (!upload) {
        throw new BadRequestException(`Upload with ID ${uploadId} not found`);
      }

      const validatedPage = Math.max(1, page);
      const validatedPageSize = Math.min(100, Math.max(1, pageSize));
      const skip = (validatedPage - 1) * validatedPageSize;

      const [items, totalCount] = await Promise.all([
        this.prismaService.mpesaPaymentReportItem.findMany({
          where: { mpesaPaymentReportUploadId: uploadId },
          skip,
          take: validatedPageSize,
          orderBy: {
            completionTime: 'desc',
          },
        }),
        this.prismaService.mpesaPaymentReportItem.count({
          where: { mpesaPaymentReportUploadId: uploadId },
        }),
      ]);

      const totalPages = Math.ceil(totalCount / validatedPageSize);

      const itemsDto = items.map((item) => ({
        id: item.id,
        transactionReference: item.transactionReference,
        completionTime: item.completionTime,
        initiationTime: item.initiationTime,
        paymentDetails: item.paymentDetails ?? undefined,
        transactionStatus: item.transactionStatus ?? undefined,
        paidIn: Number(item.paidIn),
        withdrawn: Number(item.withdrawn),
        accountBalance: Number(item.accountBalance),
        balanceConfirmed: item.balanceConfirmed ?? undefined,
        reasonType: item.reasonType,
        otherPartyInfo: item.otherPartyInfo ?? undefined,
        linkedTransactionId: item.linkedTransactionId ?? undefined,
        accountNumber: item.accountNumber ?? undefined,
        isProcessed: item.isProcessed,
        isMapped: item.isMapped,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      }));

      return {
        upload: {
          id: upload.id,
          accountHolder: upload.accountHolder,
          shortCode: upload.shortCode ?? undefined,
          account: upload.account ?? undefined,
          timeFrom: upload.timeFrom,
          timeTo: upload.timeTo,
          operator: upload.operator ?? undefined,
          reportDate: upload.reportDate ?? undefined,
          openingBalance: upload.openingBalance ? Number(upload.openingBalance) : undefined,
          closingBalance: upload.closingBalance ? Number(upload.closingBalance) : undefined,
          availableBalance: upload.availableBalance ? Number(upload.availableBalance) : undefined,
          totalPaidIn: upload.totalPaidIn ? Number(upload.totalPaidIn) : undefined,
          totalWithdrawn: upload.totalWithdrawn ? Number(upload.totalWithdrawn) : undefined,
          filePath: upload.filePath ?? undefined,
          createdBy: upload.createdBy ?? undefined,
          createdAt: upload.createdAt,
          updatedAt: upload.updatedAt,
        },
        items: itemsDto,
        pagination: {
          page: validatedPage,
          pageSize: validatedPageSize,
          totalItems: totalCount,
          totalPages,
          hasNextPage: validatedPage < totalPages,
          hasPreviousPage: validatedPage > 1,
        },
      };
    } catch (error) {
      this.logger.error(
        `[${correlationId}] Error getting upload details: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined
      );
      throw error;
    }
  }
}

