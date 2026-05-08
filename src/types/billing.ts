/**
 * Billing Types for mamaGo SaaS Billing Center
 * 
 * Architecture prepared for:
 * - BillingProfile (company requisites)
 * - Invoices (счета)
 * - Acts (акты)
 * - Legal Documents (оферта, политика)
 */

// ============================================================================
// BILLING PROFILE (Company Requisites)
// ============================================================================

export type BillingProfileCompleteness = 'complete' | 'partial' | 'empty';

export interface BillingProfile {
  id: string;
  businessId: string;
  
  // Company Information
  legalName: string;
  unp: string; // УНП (Belarusian tax ID)
  legalAddress: string;
  
  // Bank Details
  bankName: string;
  bankCode: string; // БИК
  accountNumber: string; // Расчётный счёт
  
  // Contact for Documents
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  
  // Signatory (Подписант)
  signatoryName: string;
  signatoryPosition: string;
  signatoryBasis: string; // Основание (Устав, Доверенность, etc.)
  
  // Status
  completeness: BillingProfileCompleteness;
  isVerified: boolean;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface BillingProfileFormData {
  // Company
  legalName: string;
  unp: string;
  legalAddress: string;
  
  // Bank
  bankName: string;
  bankCode: string;
  accountNumber: string;
  
  // Contact
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  
  // Signatory
  signatoryName: string;
  signatoryPosition: string;
  signatoryBasis: string;
}

// ============================================================================
// INVOICE (Счёт)
// ============================================================================

export type InvoiceType = 'topup' | 'subscription' | 'service';
export type InvoiceStatus = 'pending' | 'paid' | 'cancelled' | 'overdue';

export interface Invoice {
  id: string;
  number: string; // Invoice number (e.g., "241")
  businessId: string;
  
  // Type & Status
  type: InvoiceType;
  status: InvoiceStatus;
  
  // Amount
  amount: number;
  currency: string;
  
  // Dates
  issuedAt: Date;
  dueAt: Date;
  paidAt?: Date;
  
  // Documents
  pdfUrl?: string;
  
  // Relations
  billingTransactionId?: string;
  
  // Metadata
  description: string;
  items?: InvoiceItem[];
  
  createdAt: Date;
  updatedAt: Date;
}

export interface InvoiceItem {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

// ============================================================================
// ACT (Акт выполненных работ)
// ============================================================================

export type ActStatus = 'draft' | 'signed' | 'active';

export interface Act {
  id: string;
  number: string; // Act number (e.g., "81")
  businessId: string;
  invoiceId: string;
  
  // Status
  status: ActStatus;
  
  // Amount
  amount: number;
  currency: string;
  
  // Dates
  issuedAt: Date;
  signedAt?: Date;
  
  // Documents
  pdfUrl?: string;
  
  // Metadata
  description: string;
  services?: ActService[];
  
  createdAt: Date;
  updatedAt: Date;
}

export interface ActService {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

// ============================================================================
// LEGAL DOCUMENT (Оферта, Политика)
// ============================================================================

export type LegalDocumentType = 'offer' | 'privacy' | 'terms' | 'sla';

export interface LegalDocument {
  id: string;
  type: LegalDocumentType;
  version: string;
  title: string;
  effectiveDate: Date;
  pdfUrl: string;
  htmlUrl: string;
  isActive: boolean;
}

// ============================================================================
// BALANCE & STATS
// ============================================================================

export interface BalanceInfo {
  current: number;
  currency: string;
  lowBalanceThreshold: number;
  isLowBalance: boolean;
  lastTopUpDate?: Date;
  lastTopUpAmount?: number;
  monthlySpend: number;
}

export interface BalanceStats {
  monthSpent: number;
  chargesCount: number;
  averageCharge: number;
  lastCharge: {
    date: Date | null;
    amount: number | null;
  };
}

// ============================================================================
// TOP-UP FLOW
// ============================================================================

export interface TopUpRequest {
  amount: number;
  currency: string;
  description?: string;
}

export interface TopUpResult {
  success: boolean;
  invoiceId?: string;
  invoiceNumber?: string;
  pdfUrl?: string;
  error?: string;
}

// ============================================================================
// DOCUMENT FILTERS
// ============================================================================

export interface DocumentFilters {
  type?: 'invoice' | 'act';
  status?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

// ============================================================================
// UI STATE
// ============================================================================

export interface BillingUIState {
  isLoadingBalance: boolean;
  isLoadingDocuments: boolean;
  isLoadingRequisites: boolean;
  error: string | null;
}

// ============================================================================
// HELPERS
// ============================================================================

export const getCompletenessLabel = (completeness: BillingProfileCompleteness): string => {
  const labels: Record<BillingProfileCompleteness, string> = {
    complete: 'Заполнено',
    partial: 'Заполнено частично',
    empty: 'Не заполнено',
  };
  return labels[completeness];
};

export const getCompletenessColor = (completeness: BillingProfileCompleteness): string => {
  const colors: Record<BillingProfileCompleteness, string> = {
    complete: 'text-green-600',
    partial: 'text-orange-600',
    empty: 'text-red-600',
  };
  return colors[completeness];
};

export const getInvoiceStatusLabel = (status: InvoiceStatus): string => {
  const labels: Record<InvoiceStatus, string> = {
    pending: 'Ожидает оплату',
    paid: 'Оплачен',
    cancelled: 'Отменён',
    overdue: 'Просрочен',
  };
  return labels[status];
};

export const getActStatusLabel = (status: ActStatus): string => {
  const labels: Record<ActStatus, string> = {
    draft: 'Черновик',
    signed: 'Подписан',
    active: 'Активен',
  };
  return labels[status];
};

export const getLegalDocumentTypeLabel = (type: LegalDocumentType): string => {
  const labels: Record<LegalDocumentType, string> = {
    offer: 'Публичная оферта',
    privacy: 'Политика конфиденциальности',
    terms: 'Условия использования',
    sla: 'Соглашение об уровне обслуживания',
  };
  return labels[type];
};
