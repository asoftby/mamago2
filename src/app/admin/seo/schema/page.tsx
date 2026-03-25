import { StructuredDataCenterClient } from "@/components/admin/seo/StructuredDataCenterClient";
import {
  MOCK_SCHEMA_OVERVIEW_CARDS,
  MOCK_SCHEMA_TEMPLATES,
  MOCK_SCHEMA_VALIDATION,
} from "@/lib/admin/seo/structuredDataMock";

export default function AdminSeoSchemaPage() {
  return (
    <StructuredDataCenterClient
      initialOverviewCards={MOCK_SCHEMA_OVERVIEW_CARDS}
      initialTemplates={MOCK_SCHEMA_TEMPLATES}
      initialValidation={MOCK_SCHEMA_VALIDATION}
    />
  );
}
