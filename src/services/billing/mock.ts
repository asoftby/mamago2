/**
 * Mock Billing Services
 * 
 * Provides mock data for billing features until backend is ready.
 * This allows frontend development to proceed independently.
 */

import type {
  BillingProfile,
  Invoice,
  Act,
  LegalDocument,
  BalanceInfo,
  BalanceStats,
} from '@/types/billing';

// ============================================================================
// BILLING PROFILE
// ============================================================================

export const mockBillingProfile = (): BillingProfile | null => {
  // Return null to simulate empty state
  // When backend is ready, this will fetch real data
  return null;
};

export const mockBillingProfileComplete = (): BillingProfile => {
  return {
    id: 'mock-profile-1',
    businessId: 'mock-business-1',
    
    // Company
    legalName: 'ООО "Детский центр развития"',
    unp: '123456789',
    legalAddress: 'г. Минск, ул. Ленина, д. 1, оф. 101',
    
    // Bank
    bankName: 'ОАО "Беларусбанк"',
    bankCode: 'AKBBBY2X',
    accountNumber: 'BY86AKBB30120000000000000933',
    
    // Contact
    contactName: 'Иванов Иван Иванович',
    contactEmail: 'ivanov@example.com',
    contactPhone: '+375 29 123 45 67',
    
    // Signatory
    signatoryName: 'Петров Петр Петрович',
    signatoryPosition: 'Директор',
    signatoryBasis: 'Устав',
    
    // Status
    completeness: 'complete',
    isVerified: true,
    
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15'),
  };
};

// ============================================================================
// INVOICES
// ============================================================================

export const mockInvoices = (): Invoice[] => {
  // Return empty array to simulate no invoices yet
  // When backend is ready, this will fetch real data
  return [];
};

export const mockInvoicesWithData = (): Invoice[] => {
  return [
    {
      id: 'mock-invoice-1',
      number: '241',
      businessId: 'mock-business-1',
      type: 'topup',
      status: 'pending',
      amount: 500,
      currency: 'BYN',
      issuedAt: new Date('2026-05-07'),
      dueAt: new Date('2026-05-14'),
      description: 'Пополнение баланса',
      pdfUrl: '/mock/invoice-241.pdf',
      createdAt: new Date('2026-05-07'),
      updatedAt: new Date('2026-05-07'),
    },
    {
      id: 'mock-invoice-2',
      number: '220',
      businessId: 'mock-business-1',
      type: 'subscription',
      status: 'paid',
      amount: 100,
      currency: 'BYN',
      issuedAt: new Date('2026-04-01'),
      dueAt: new Date('2026-04-08'),
      paidAt: new Date('2026-04-05'),
      description: 'Подписка на тариф "Стандарт"',
      pdfUrl: '/mock/invoice-220.pdf',
      createdAt: new Date('2026-04-01'),
      updatedAt: new Date('2026-04-05'),
    },
  ];
};

// ============================================================================
// ACTS
// ============================================================================

export const mockActs = (): Act[] => {
  // Return empty array to simulate no acts yet
  return [];
};

export const mockActsWithData = (): Act[] => {
  return [
    {
      id: 'mock-act-1',
      number: '81',
      businessId: 'mock-business-1',
      invoiceId: 'mock-invoice-2',
      status: 'signed',
      amount: 100,
      currency: 'BYN',
      issuedAt: new Date('2026-04-30'),
      signedAt: new Date('2026-04-30'),
      description: 'Акт выполненных работ за апрель 2026',
      pdfUrl: '/mock/act-81.pdf',
      createdAt: new Date('2026-04-30'),
      updatedAt: new Date('2026-04-30'),
    },
  ];
};

// ============================================================================
// LEGAL DOCUMENTS
// ============================================================================

export const mockLegalDocuments = (): LegalDocument[] => {
  return [
    {
      id: 'legal-offer-1',
      type: 'offer',
      version: '1.0',
      title: 'Публичная оферта',
      effectiveDate: new Date('2024-01-01'),
      pdfUrl: '/legal/offer-v1.0.pdf',
      htmlUrl: '/legal/offer',
      isActive: true,
    },
    {
      id: 'legal-privacy-1',
      type: 'privacy',
      version: '1.0',
      title: 'Политика конфиденциальности',
      effectiveDate: new Date('2024-01-01'),
      pdfUrl: '/legal/privacy-v1.0.pdf',
      htmlUrl: '/legal/privacy',
      isActive: true,
    },
  ];
};

// ============================================================================
// BALANCE INFO
// ============================================================================

export const mockBalanceInfo = (currentBalance: number): BalanceInfo => {
  const lowBalanceThreshold = 20;
  
  return {
    current: currentBalance,
    currency: 'BYN',
    lowBalanceThreshold,
    isLowBalance: currentBalance < lowBalanceThreshold,
    lastTopUpDate: new Date('2026-05-07'),
    lastTopUpAmount: 50,
    monthlySpend: 125.50,
  };
};

// ============================================================================
// BALANCE STATS
// ============================================================================

export const mockBalanceStats = (): BalanceStats => {
  return {
    monthSpent: 125.50,
    chargesCount: 8,
    averageCharge: 15.69,
    lastCharge: {
      date: new Date('2026-05-06'),
      amount: 25,
    },
  };
};

// ============================================================================
// QUICK TOP-UP AMOUNTS
// ============================================================================

export const QUICK_TOPUP_AMOUNTS = [50, 100, 250, 500];

// ============================================================================
// HELPERS
// ============================================================================

export const groupDocumentsByMonth = (
  invoices: Invoice[],
  acts: Act[]
): Record<string, { invoices: Invoice[]; acts: Act[] }> => {
  const grouped: Record<string, { invoices: Invoice[]; acts: Act[] }> = {};
  
  // Group invoices
  invoices.forEach((invoice) => {
    const monthKey = invoice.issuedAt.toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
    }).toUpperCase();
    
    if (!grouped[monthKey]) {
      grouped[monthKey] = { invoices: [], acts: [] };
    }
    grouped[monthKey].invoices.push(invoice);
  });
  
  // Group acts
  acts.forEach((act) => {
    const monthKey = act.issuedAt.toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
    }).toUpperCase();
    
    if (!grouped[monthKey]) {
      grouped[monthKey] = { invoices: [], acts: [] };
    }
    grouped[monthKey].acts.push(act);
  });
  
  return grouped;
};

export const calculateCompleteness = (profile: Partial<BillingProfile>): 'complete' | 'partial' | 'empty' => {
  const requiredFields = [
    'legalName',
    'unp',
    'legalAddress',
    'bankName',
    'bankCode',
    'accountNumber',
    'contactName',
    'contactEmail',
    'contactPhone',
    'signatoryName',
    'signatoryPosition',
    'signatoryBasis',
  ];
  
  const filledFields = requiredFields.filter((field) => {
    const value = profile[field as keyof BillingProfile];
    return value && value !== '';
  });
  
  if (filledFields.length === 0) return 'empty';
  if (filledFields.length === requiredFields.length) return 'complete';
  return 'partial';
};
