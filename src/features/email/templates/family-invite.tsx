import { Section, Text } from "@react-email/components";
import * as React from "react";

import { EmailButton } from "../components/email-button";
import { EmailFooter } from "../components/email-footer";
import { EmailLayout } from "../components/email-layout";

export interface FamilyInviteTemplateProps {
  inviterName?: string | null;
  acceptUrl: string;
}

/** Neutral by design: no child data, no plan content. */
export default function FamilyInviteTemplate({
  inviterName,
  acceptUrl,
}: FamilyInviteTemplateProps) {
  return (
    <EmailLayout preview="Вас пригласили в семейный план mamaGo">
      <Text style={{ margin: "0 0 16px" }}>Здравствуйте!</Text>
      <Text style={{ margin: "0 0 20px" }}>
        {inviterName ? `${inviterName} приглашает` : "Вас приглашают"} вас присоединиться к семье на
        mamaGo, чтобы вместе планировать досуг.
      </Text>
      <Section style={{ margin: "0 0 24px", textAlign: "center" as const }}>
        <EmailButton href={acceptUrl}>Открыть приглашение</EmailButton>
      </Section>
      <Text style={{ color: "#5c5c5c", fontSize: 14, lineHeight: 1.5, margin: "0 0 16px" }}>
        Если кнопка не открывается, скопируйте ссылку в браузер:
        <br />
        <span style={{ color: "#1a1a1a", wordBreak: "break-all" as const }}>{acceptUrl}</span>
      </Text>
      <Text style={{ color: "#5c5c5c", fontSize: 14, lineHeight: 1.5, margin: "0 0 16px" }}>
        Ссылка одноразовая и без срока действия: не пересылайте её посторонним. Отозвать её можно в профиле, в разделе «Семья».
      </Text>
      <Text style={{ fontSize: 14, lineHeight: 1.5, margin: 0 }}>
        Если вы не ожидали это письмо, просто проигнорируйте его.
      </Text>
      <EmailFooter reason="Вы получили это письмо, потому что вас пригласили в семью на mamaGo." />
    </EmailLayout>
  );
}
