import { redirect } from "next/navigation";

/** Single-city default until a real national city hub is needed. */
export default function RootPage() {
  redirect("/minsk");
}
