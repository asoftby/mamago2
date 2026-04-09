import { Section, Text } from "@react-email/components";
import * as React from "react";

import { EmailButton } from "../components/email-button";
import { EmailFooter } from "../components/email-footer";
import { EmailLayout } from "../components/email-layout";

export interface PasswordResetTemplateProps {
  resetUrl: string;
}

export default function PasswordResetTemplate({ resetUrl }: PasswordResetTemplateProps) {
  return (
    <EmailLayout preview="Ссылка для сброса пароля в mamaGo.">
      <Text style={{ margin: "0 0 16px" }}>Здравствуйте!</Text>
      <Text style={{ margin: "0 0 20px" }}>
        Вы запросили сброс пароля для аккаунта mamaGo. Нажмите кнопку ниже, чтобы задать новый
        пароль.
      </Text>
      <Section style={{ margin: "0 0 24px", textAlign: "center" as const }}>
        <EmailButton href={resetUrl}>Сбросить пароль</EmailButton>
      </Section>
      <Text style={{ color: "#5c5c5c", fontSize: 14, lineHeight: 1.5, margin: "0 0 16px" }}>
        Если кнопка не открывается, скопируйте ссылку в браузер:
        <br />
        <span style={{ color: "#1a1a1a", wordBreak: "break-all" as const }}>{resetUrl}</span>
      </Text>
      <Text style={{ fontSize: 14, lineHeight: 1.5, margin: 0 }}>
        Если вы не запрашивали сброс, просто проигнорируйте это письмо — пароль останется прежним.
      </Text>
      <EmailFooter reason="Вы получили это письмо, потому что запросили сброс пароля в mamaGo." />
    </EmailLayout>
  );
}
