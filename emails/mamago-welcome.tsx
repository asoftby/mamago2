import * as React from "react";
import { Section, Text } from "@react-email/components";

import { EmailButton } from "../src/features/email/components/email-button";
import { EmailFooter } from "../src/features/email/components/email-footer";
import { EmailLayout, emailTheme } from "../src/features/email/components/email-layout";

export interface MamagoWelcomeEmailProps {
  ctaUrl?: string;
  unsubscribeUrl?: string;
  userName?: string | null;
  /** Plain text, already rendered from the scenario editor if overridden. */
  introText?: string | null;
}

export const PreviewProps: MamagoWelcomeEmailProps = {
  userName: "Катя",
  ctaUrl: "https://mamago.by/me/plan",
};

const DEFAULT_CTA_URL = "https://mamago.by/me/plan";

/**
 * Code-first welcome design. Editorial text may be overridden from the
 * communications scenario editor without changing the email's visual shell.
 */
function MamagoWelcome({
  ctaUrl = DEFAULT_CTA_URL,
  userName,
  introText,
  unsubscribeUrl,
}: MamagoWelcomeEmailProps) {
  const firstName = userName?.trim().split(/\s+/)[0] || null;

  return (
    <EmailLayout preview="Меньше поисков, больше времени вместе. Начните с первого семейного плана.">
      <Section style={{ margin: "0 0 28px" }}>
        <Text style={eyebrow}>ДОБРО ПОЖАЛОВАТЬ В MAMAGO</Text>
        <Text style={greeting}>Привет{firstName ? `, ${firstName}` : ""}!</Text>
        <Text style={headline}>Меньше поисков.<br />Больше времени вместе.</Text>
        <Text style={intro}>
          {introText?.trim()
            ? introText
            : "У нас есть идеи для семейного отдыха, занятий и маленьких приключений. А у вас — возможность собрать из них день, который понравится всей семье."}
        </Text>
      </Section>

      <Section style={warmCard}>
        <Text style={cardEyebrow}>ВАШ ПЛАН НА ВЫХОДНЫЕ</Text>
        <Text style={cardTitle}>Всё начинается с одной идеи</Text>
        <Text style={cardDescription}>
          Не нужно держать десятки вкладок открытыми. Выберите интересное, добавьте в план — и всё важное останется под рукой.
        </Text>
        <Section style={stepsSection}>
          <table role="presentation" width="100%" cellPadding="0" cellSpacing="0">
            <tbody>
              <tr>
                <td style={stepNumber}>01</td>
                <td style={stepText}>Находите события, места и занятия</td>
              </tr>
              <tr>
                <td style={stepNumber}>02</td>
                <td style={stepText}>Сохраняйте идеи в «Мой план»</td>
              </tr>
              <tr>
                <td style={{ ...stepNumber, paddingBottom: 0 }}>03</td>
                <td style={{ ...stepText, paddingBottom: 0 }}>Проводите больше времени вместе</td>
              </tr>
            </tbody>
          </table>
        </Section>
      </Section>

      <Section style={{ margin: "30px 0 28px" }}>
        <EmailButton href={ctaUrl}>Собрать первый план</EmailButton>
        <Text style={buttonHint}>Начните с любой идеи. Дальше mamaGo поможет.</Text>
      </Section>

      <Section style={{ margin: "0 0 26px" }}>
        <Text style={signOff}>
          До встречи в ваших новых семейных историях!<br />
          Команда mamaGo
        </Text>
      </Section>

      <EmailFooter reason="Вы получили это письмо, потому что зарегистрировались в mamaGo." />
      {unsubscribeUrl ? (
        <Text style={unsubscribe}>
          <a href={unsubscribeUrl} style={{ color: emailTheme.muted, textDecoration: "underline" }}>
            Отписаться от рассылки
          </a>
        </Text>
      ) : null}
    </EmailLayout>
  );
}

const eyebrow: React.CSSProperties = {
  margin: "0 0 12px",
  fontSize: 11,
  lineHeight: "17px",
  fontWeight: 700,
  letterSpacing: "0.11em",
  color: emailTheme.accent,
};

const greeting: React.CSSProperties = {
  margin: "0 0 10px",
  color: emailTheme.ink,
  fontWeight: 700,
  fontSize: 38,
  lineHeight: "44px",
  letterSpacing: "-0.04em",
};

const headline: React.CSSProperties = {
  margin: "0 0 20px",
  color: emailTheme.ink,
  fontWeight: 700,
  fontSize: 26,
  lineHeight: "33px",
  letterSpacing: "-0.025em",
};

const intro: React.CSSProperties = {
  color: emailTheme.text,
  fontSize: 16,
  lineHeight: "26px",
  margin: 0,
};

const warmCard: React.CSSProperties = {
  margin: 0,
  padding: "26px 24px",
  backgroundColor: emailTheme.warm,
  borderRadius: 16,
};

const cardEyebrow: React.CSSProperties = {
  color: "#96632D",
  fontSize: 11,
  lineHeight: "16px",
  fontWeight: 700,
  letterSpacing: "0.1em",
  margin: "0 0 9px",
};

const cardTitle: React.CSSProperties = {
  color: emailTheme.ink,
  fontSize: 23,
  fontWeight: 700,
  lineHeight: "29px",
  letterSpacing: "-0.03em",
  margin: "0 0 12px",
};

const cardDescription: React.CSSProperties = {
  color: emailTheme.text,
  fontSize: 14,
  lineHeight: "22px",
  margin: "0 0 24px",
};

const stepsSection: React.CSSProperties = {
  padding: "19px 0 0",
  borderTop: "1px solid #E9D8BB",
};

const stepNumber: React.CSSProperties = {
  verticalAlign: "top",
  width: 38,
  padding: "0 12px 13px 0",
  color: "#AD6C39",
  fontSize: 13,
  lineHeight: "20px",
  fontWeight: 700,
};

const stepText: React.CSSProperties = {
  verticalAlign: "top",
  color: emailTheme.ink,
  fontSize: 14,
  lineHeight: "21px",
  padding: "0 0 13px",
};

const buttonHint: React.CSSProperties = {
  color: emailTheme.muted,
  fontSize: 12,
  lineHeight: "18px",
  margin: "12px 0 0",
};

const signOff: React.CSSProperties = {
  color: emailTheme.text,
  fontSize: 14,
  lineHeight: "22px",
  margin: 0,
};

const unsubscribe: React.CSSProperties = {
  color: emailTheme.muted,
  fontSize: 12,
  lineHeight: "18px",
  margin: "10px 0 0",
};

MamagoWelcome.PreviewProps = PreviewProps;

export default MamagoWelcome;
