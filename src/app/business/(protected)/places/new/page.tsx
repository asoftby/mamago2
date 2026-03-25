/**
 * Legacy URL — create flow lives in the isolated content editor.
 */

import { redirect } from "next/navigation";

export default async function NewPlacePage() {
  redirect("/editor/place/new");
}
