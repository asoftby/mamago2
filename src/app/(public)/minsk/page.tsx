import type { Metadata } from "next";
import { MinskCityHomePage } from "@/features/city-home/pages/MinskCityHomePage";

export const metadata: Metadata = {
  title: "Минск — семейная афиша и идеи | mamaGo",
  description:
    "Афиша событий, занятия, маршруты и журнал mamaGo — городской хаб для семей с детьми в Минске.",
};

export default function MinskCityHomeRoute() {
  return <MinskCityHomePage />;
}
