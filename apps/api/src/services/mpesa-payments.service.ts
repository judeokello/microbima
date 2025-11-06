/// <reference types="multer" />
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MpesaStatementReasonType } from '@prisma/client';
import * as XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';
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

/**
 * MPESA Payments Service
 *
 * Handles MPESA payment statement uploads, Excel parsing, and database operations
 */
@Injectable()
export class MpesaPaymentsService {
  private readonly logger = new Logger(MpesaPaymentsService.name);

  constructor(private readonly prismaService: PrismaService) {}

  /**
   * Determine if we should use Supabase Storage based on environment
   */
  private shouldUseSupabaseStorage(): boolean {
    const nodeEnv = process.env.NODE_ENV as string | undefined;
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
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseServiceKey) {
        throw new BadRequestException('Server configuration error - Supabase credentials not found');
      }

      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });

      const storagePath = `statements/${userId}/${timestampedFileName}`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from('mpesa_statements')
        .upload(storagePath, file.buffer, {
          contentType: file.mimetype || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          upsert: false, // Don't overwrite - we've already added timestamp
        });

      if (uploadError) {
        this.logger.error(`[${correlationId}] Supabase Storage upload error: ${uploadError.message}`);
        throw new BadRequestException(`Failed to upload to storage: ${uploadError.message}`);
      }

      // Get the file URL (for private buckets, we'll store the path)
      const { data } = supabaseAdmin.storage
        .from('mpesa_statements')
        .getPublicUrl(storagePath);

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
  private findValueByLabel(worksheet: XLSX.WorkSheet, rowIndex: number, label: string): string | null {
    const row = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null })[rowIndex] as any[];
    if (!row) return null;

    for (let col = 0; col < row.length; col++) {
      const cellValue = row[col];
      if (cellValue && typeof cellValue === 'string' && cellValue.trim() === label) {
        // Found the label, return the next cell value
        if (col + 1 < row.length) {
          return row[col + 1]?.toString() || null;
        }
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
      const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null }) as any[];

      // Parse header rows (1-6, 0-indexed: 0-5)
      const header: ExcelHeaderData = {
        accountHolder: rows[0]?.[1]?.toString() || '', // Row 1, Column B
        shortCode: rows[1]?.[1]?.toString() || undefined, // Row 2, Column B
        account: rows[2]?.[1]?.toString() || undefined, // Row 3, Column B
        timeFrom: this.parseDateTime(rows[3]?.[3]?.toString() || ''), // Row 4, Column D
        timeTo: this.parseDateTime(rows[3]?.[5]?.toString() || ''), // Row 4, Column F
        operator: rows[4]?.[1]?.toString() || undefined, // Row 5, Column B
      };

      // Parse row 6 using label matching
      const openingBalanceStr = this.findValueByLabel(worksheet, 5, 'Opening Balance'); // Row 6 (0-indexed: 5)
      const closingBalanceStr = this.findValueByLabel(worksheet, 5, 'Closing Balance');
      const availableBalanceStr = this.findValueByLabel(worksheet, 5, 'Available Balance');
      const totalPaidInStr = this.findValueByLabel(worksheet, 5, 'Total Paid In');
      const totalWithdrawnStr = this.findValueByLabel(worksheet, 5, 'Total Withdrawn');

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
        if (!row || !row[0]) continue; // Skip empty rows

        const transactionReference = row[0]?.toString()?.trim();
        if (!transactionReference) continue; // Skip rows without receipt number

        const transaction: ExcelTransactionRow = {
          transactionReference,
          completionTime: this.parseDateTime(row[1]?.toString() || ''), // Column B
          initiationTime: this.parseDateTime(row[2]?.toString() || ''), // Column C
          paymentDetails: row[3]?.toString()?.trim() || undefined, // Column D
          transactionStatus: row[4]?.toString()?.trim() || undefined, // Column E
          paidIn: this.parseDecimal(row[5]?.toString() || '0'), // Column F
          withdrawn: this.parseDecimal(row[6]?.toString() || '0'), // Column G
          accountBalance: this.parseDecimal(row[7]?.toString() || '0'), // Column H
          balanceConfirmed: row[8]?.toString()?.trim() || undefined, // Column I
          reasonType: row[9]?.toString()?.trim() || 'Unmapped', // Column J
          otherPartyInfo: row[10]?.toString()?.trim() || undefined, // Column K
          linkedTransactionId: row[11]?.toString()?.trim() || undefined, // Column L
          accountNumber: row[12]?.toString()?.trim() || undefined, // Column M
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
  private parseDecimal(value: string): number {
    if (!value) return 0;
    // Remove commas, currency symbols, and whitespace
    const cleaned = value.toString().replace(/[,\s$KES]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }

  /**
   * Parse datetime from string (handles various formats)
   */
  private parseDateTime(value: string): Date {
    if (!value) return new Date();
    
    // Try parsing as ISO string first
    const isoDate = new Date(value);
    if (!isNaN(isoDate.getTime())) {
      return isoDate;
    }

    // Try parsing as Excel date number
    const excelDate = parseFloat(value);
    if (!isNaN(excelDate) && excelDate > 0) {
      // Excel dates are days since 1900-01-01
      const excelEpoch = new Date(1899, 11, 30);
      return new Date(excelEpoch.getTime() + excelDate * 86400000);
    }

    // Try common date formats
    const formats = [
      /(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/, // DD-MM-YYYY HH:MM:SS
      /(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/, // YYYY-MM-DD HH:MM:SS
    ];

    for (const format of formats) {
      const match = value.match(format);
      if (match) {
        if (format === formats[0]) {
          // DD-MM-YYYY format
          return new Date(
            parseInt(match[3]),
            parseInt(match[2]) - 1,
            parseInt(match[1]),
            parseInt(match[4]),
            parseInt(match[5]),
            parseInt(match[6])
          );
        } else {
          // YYYY-MM-DD format
          return new Date(
            parseInt(match[1]),
            parseInt(match[2]) - 1,
            parseInt(match[3]),
            parseInt(match[4]),
            parseInt(match[5]),
            parseInt(match[6])
          );
        }
      }
    }

    // Fallback to current date
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

