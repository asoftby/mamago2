import * as React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Html,
  Img,
  Preview,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";

export interface MamagoWelcomeEmailProps {
  userName?: string;
  ctaUrl?: string;
  unsubscribeUrl?: string;
}

export const PreviewProps: MamagoWelcomeEmailProps = {
  userName: "Аня",
  ctaUrl: "https://mamago.by/me/plan",
  unsubscribeUrl: "https://mamago.by/u/demo-token",
};

function MamagoWelcome({
  userName = "друг",
  ctaUrl = "https://mamago.by/me/plan",
  unsubscribeUrl,
}: MamagoWelcomeEmailProps) {
  const logoBaseUrl = (() => {
    try {
      return new URL(ctaUrl).origin;
    } catch {
      return "https://mamago.by";
    }
  })();
  const logoUrl = `${logoBaseUrl}/logomamago.webp`;

  return (
    <Html lang="ru">
      <Head />
      <Preview>Соберите первый план на выходные с mamaGo меньше чем за минуту.</Preview>
      <Tailwind>
        <Body
          style={{
            backgroundColor: "#f8f7f5",
            margin: "0",
            padding: "32px 16px",
            fontFamily:
              "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            color: "#1f1f1f",
          }}
        >
          <Container className="mx-auto max-w-[1140px]">
            <Section
              style={{
                backgroundColor: "#f6f6f4",
                borderRadius: "22px",
                padding: "56px 46px 46px",
              }}
            >
              <Section style={{ margin: "0 0 34px" }}>
                <table
                  role="presentation"
                  width="100%"
                  cellPadding="0"
                  cellSpacing="0"
                  style={{ borderCollapse: "collapse" }}
                >
                  <tbody>
                    <tr>
                      <td valign="top">
                        <Text
                          style={{
                            margin: "0",
                            fontSize: "42px",
                            lineHeight: "1.08",
                            fontWeight: 700,
                            color: "#111111",
                          }}
                        >
                          Привет 👋
                        </Text>
                      </td>
                      <td align="right" valign="top">
                        <Img
                          src={logoUrl}
                          alt="mamaGo"
                          width="136"
                          height="52"
                          style={{ display: "block" }}
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </Section>

              <Text
                style={{
                  margin: "0 0 34px",
                  fontSize: "16px",
                  lineHeight: "1.5",
                  color: "#171717",
                }}
              >
                Не знаешь, куда пойти с ребёнком?
                И каждые выходные снова одно и то же?
              </Text>

              <Section
                style={{
                  backgroundColor: "#fff1cb",
                  borderRadius: "16px",
                  padding: "34px 38px",
                  margin: "0 0 38px",
                }}
              >
                <Text
                  style={{
                    margin: "0 0 22px",
                    fontSize: "16px",
                    lineHeight: "1.4",
                    fontWeight: 500,
                    color: "#111111",
                  }}
                >
                  mamaGo помогает:
                </Text>
                <Text
                  style={{
                    margin: "0",
                    fontSize: "16px",
                    lineHeight: "1.55",
                    color: "#111111",
                  }}
                >
                  - находить идеи
                  <br />- планировать дни
                  <br />- экономить время и нервы
                </Text>
              </Section>

              <Text
                style={{
                  margin: "0 0 34px",
                  fontSize: "21px",
                  lineHeight: "1.45",
                  color: "#111111",
                }}
              >
                Добавь 2–3 идеи → собери план на выходные → просто следуй ему
              </Text>

              <Text
                style={{
                  margin: "0 0 20px",
                  fontSize: "18px",
                  lineHeight: "1.4",
                  color: "#111111",
                }}
              >
                ✨ Первый раз за долгое время выходные проходят спокойно
              </Text>

              <Section style={{ margin: "0 0 40px" }}>
                <Button
                  href={ctaUrl}
                  style={{
                    backgroundColor: "#EF8759",
                    color: "#ffffff",
                    borderRadius: "14px",
                    fontSize: "18px",
                    fontWeight: 500,
                    textDecoration: "none",
                    textAlign: "center",
                    display: "inline-block",
                    padding: "18px 34px",
                  }}
                >
                  На сайт mamaGo
                </Button>
              </Section>

              <Text
                style={{
                  margin: "0 0 8px",
                  fontSize: "18px",
                  lineHeight: "1.2",
                  color: "#111111",
                  textDecoration: "underline",
                }}
              >
                mamaGo.by
              </Text>
              <Text
                style={{
                  margin: "0",
                  fontSize: "15px",
                  lineHeight: "1.45",
                  color: "#222222",
                }}
              >
                Персональный помощник в организации семейного отдыха и развития
              </Text>
              
              {unsubscribeUrl ? (
                <Text
                  style={{
                    margin: "16px 0 0",
                    fontSize: "13px",
                    lineHeight: "1.4",
                    color: "#9ca3af",
                  }}
                >
                  <a
                    href={unsubscribeUrl}
                    style={{
                      color: "#6b7280",
                      textDecoration: "underline",
                    }}
                  >
                    Отписаться от рассылки
                  </a>
                </Text>
              ) : null}
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

MamagoWelcome.PreviewProps = PreviewProps;

export default MamagoWelcome;
