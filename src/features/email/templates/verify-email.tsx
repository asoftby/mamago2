import { Section, Text } from "@react-email/components";
import * as React from "react";

import { EmailButton } from "../components/email-button";
import { EmailFooter } from "../components/email-footer";
import { EmailLayout } from "../components/email-layout";

export interface VerifyEmailTemplateProps {
  verifyUrl: string;
}

export default function VerifyEmailTemplate({ verifyUrl }: VerifyEmailTemplateProps) {
  return (
    <EmailLayout preview="Подтвердите email, чтобы пользоваться mamaGo без ограничений.">
      <Text style={{ margin: "0 0 16px" }}>Здравствуйте!</Text>
      <Text style={{ margin: "0 0 20px" }}>
        Спасибо за регистрацию. Подтвердите email — так мы поймём, что адрес принадлежит вам, и
        сможем присылать важные уведомления.
      </Text>
      <Section style={{ margin: "0 0 24px", textAlign: "center" as const }}>
        <EmailButton href={verifyUrl}>Подтвердить email</EmailButton>
      </Section>
      <Text style={{ color: "#5c5c5c", fontSize: 14, lineHeight: 1.5, margin: "0 0 16px" }}>
        Если кнопка не открывается, скопируйте ссылку в браузер:
        <br />
        <span style={{ color: "#1a1a1a", wordBreak: "break-all" as const }}>{verifyUrl}</span>
      </Text>
      <Text style={{ fontSize: 14, lineHeight: 1.5, margin: 0 }}>
        Если вы не создавали аккаунт в mamaGo, просто проигнорируйте это письмо.
      </Text>
      <EmailFooter reason="Вы получили это письмо, потому что зарегистрировались в mamaGo." />
    </EmailLayout>
  );
}
