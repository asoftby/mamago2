import { Section, Text } from "@react-email/components";
import * as React from "react";

import { EmailButton } from "../components/email-button";
import { EmailFooter } from "../components/email-footer";
import { EmailLayout } from "../components/email-layout";

export interface BusinessInviteTemplateProps {
  businessName: string;
  inviterName?: string | null;
  acceptUrl: string;
  expiresInDays: number;
}

export default function BusinessInviteTemplate({
  businessName,
  inviterName,
  acceptUrl,
  expiresInDays,
}: BusinessInviteTemplateProps) {
  return (
    <EmailLayout preview={`Вас пригласили в команду бизнеса ${businessName}`}>
      <Text style={{ margin: "0 0 16px" }}>Здравствуйте!</Text>
      <Text style={{ margin: "0 0 20px" }}>
        {inviterName ? `${inviterName} пригласил` : "Вас пригласили"} вас в команду бизнеса{" "}
        <strong>{businessName}</strong> на платформе mamaGo.
      </Text>
      <Text style={{ margin: "0 0 20px" }}>
        Вы получите доступ к управлению событиями, предложениями и другими возможностями для
        развития бизнеса.
      </Text>
      <Section style={{ margin: "0 0 24px", textAlign: "center" as const }}>
        <EmailButton href={acceptUrl}>Принять приглашение</EmailButton>
      </Section>
      <Text style={{ color: "#5c5c5c", fontSize: 14, lineHeight: 1.5, margin: "0 0 16px" }}>
        Если кнопка не открывается, скопируйте ссылку в браузер:
        <br />
        <span style={{ color: "#1a1a1a", wordBreak: "break-all" as const }}>{acceptUrl}</span>
      </Text>
      <Text style={{ color: "#5c5c5c", fontSize: 14, lineHeight: 1.5, margin: "0 0 16px" }}>
        Приглашение действует {expiresInDays} {expiresInDays === 7 ? "дней" : "дня"}.
      </Text>
      <Text style={{ fontSize: 14, lineHeight: 1.5, margin: 0 }}>
        Если вы не ожидали это приглашение, просто проигнорируйте это письмо.
      </Text>
      <EmailFooter reason={`Вы получили это письмо, потому что вас пригласили в команду бизнеса ${businessName}.`} />
    </EmailLayout>
  );
}
