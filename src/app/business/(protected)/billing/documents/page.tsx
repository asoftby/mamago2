import { getCurrentUser } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { LegalDocumentsBlock } from "@/components/business/billing/LegalDocumentsBlock";
import { DocumentsList } from "@/components/business/billing/DocumentsList";
import {
  mockLegalDocuments,
  mockInvoices,
  mockActs,
  groupDocumentsByMonth,
} from "@/services/billing/mock";

// Force dynamic rendering
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BillingDocumentsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  // Get user's business
  const business = await prisma.business.findUnique({
    where: { ownerUserId: user.id },
    select: {
      id: true,
      name: true,
    },
  });

  if (!business) {
    redirect("/business/onboarding");
  }

  // TODO: Fetch real documents from database when backend is ready
  // For now, use mock data
  const legalDocuments = mockLegalDocuments();
  const invoices = mockInvoices();
  const acts = mockActs();

  // Group documents by month
  const groupedDocuments = groupDocumentsByMonth(invoices, acts);

  return (
    <div className="space-y-6">
      {/* Legal Documents Block (Always Visible) */}
      <LegalDocumentsBlock documents={legalDocuments} />

      {/* Documents List (Invoices & Acts) */}
      <DocumentsList groupedDocuments={groupedDocuments} />
    </div>
  );
}
