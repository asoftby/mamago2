import type { Metadata } from "next";
import { DirectInboxEmptyDetail } from "@/components/direct/DirectInbox";

export const metadata: Metadata = {
  title: "Мои сообщения — mamaGo",
};

/** The list itself lives in the layout; on desktop this is the empty right column. */
export default function DirectIndexPage() {
  return <DirectInboxEmptyDetail />;
}
