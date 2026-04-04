import type { Metadata } from "next";
import MinskCityHomePage from "@/features/city-home/pages/MinskCityHomePage";
import { publicSiteBase } from "@/lib/seo/cityKudaListingMetadata";

export const metadata: Metadata = {
  title: "Минск — семейная афиша и идеи | mamaGo",
  description:
    "Афиша событий, занятия, маршруты и журнал mamaGo — городской хаб для семей с детьми в Минске.",
  alternates: {
    canonical: `${publicSiteBase()}/minsk/events`,
  },
};

export default MinskCityHomePage;
