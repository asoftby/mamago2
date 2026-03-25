import { RedirectCenterClient } from "@/components/admin/seo/RedirectCenterClient";
import {
  MOCK_AUTOMATIC_REDIRECTS,
  MOCK_MANUAL_REDIRECTS,
  MOCK_UNMATCHED_URLS,
} from "@/lib/admin/seo/redirectCenterMock";

export default function AdminSeoRedirectsPage() {
  return (
    <RedirectCenterClient
      initialAutomatic={MOCK_AUTOMATIC_REDIRECTS}
      initialManual={MOCK_MANUAL_REDIRECTS}
      initialUnmatched={MOCK_UNMATCHED_URLS}
    />
  );
}
