import "server-only";

export type EmailPreviewPreset = "new-user" | "user-with-child" | "plan-reminder" | "empty-state";

export type EmailTemplateRenderContext = {
  user: {
    firstName?: string | null;
    fullName?: string | null;
  };
  city: {
    name?: string | null;
  };
  links: {
    homeUrl?: string | null;
    verifyEmailUrl?: string | null;
    resetPasswordUrl?: string | null;
    unsubscribeUrl?: string | null;
  };
  plan: {
    date?: string | null;
  };
  brand: {
    name?: string | null;
    supportEmail?: string | null;
  };
};

function getDefaultHomeUrl(): string {
  return process.env.APP_PUBLIC_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://mamago.by";
}

function getDefaultSupportEmail(): string {
  return (
    process.env.EMAIL_REPLY_TO?.trim() ||
    process.env.EMAIL_FROM?.trim() ||
    "support@mamago.by"
  );
}

export function buildEmailPreviewData(
  preset: EmailPreviewPreset,
): EmailTemplateRenderContext {
  const homeUrl = getDefaultHomeUrl();
  const supportEmail = getDefaultSupportEmail();

  switch (preset) {
    case "new-user":
      return {
        user: { firstName: "Аня", fullName: "Аня Петрова" },
        city: { name: "Минск" },
        links: {
          homeUrl,
          verifyEmailUrl: `${homeUrl}/verify-email/demo-token`,
          resetPasswordUrl: `${homeUrl}/reset-password/demo-token`,
          unsubscribeUrl: `${homeUrl}/unsubscribe/demo`,
        },
        plan: { date: "в субботу, 12 апреля" },
        brand: { name: "mamaGo", supportEmail },
      };
    case "user-with-child":
      return {
        user: { firstName: "Катя", fullName: "Катя Иванова" },
        city: { name: "Минск" },
        links: {
          homeUrl: `${homeUrl}/me/plan`,
          verifyEmailUrl: `${homeUrl}/verify-email/demo-token`,
          resetPasswordUrl: `${homeUrl}/reset-password/demo-token`,
          unsubscribeUrl: `${homeUrl}/unsubscribe/demo`,
        },
        plan: { date: "на этих выходных" },
        brand: { name: "mamaGo", supportEmail },
      };
    case "plan-reminder":
      return {
        user: { firstName: "Оля", fullName: "Оля Сидорова" },
        city: { name: "Минск" },
        links: {
          homeUrl: `${homeUrl}/me/plan`,
          verifyEmailUrl: `${homeUrl}/verify-email/demo-token`,
          resetPasswordUrl: `${homeUrl}/reset-password/demo-token`,
          unsubscribeUrl: `${homeUrl}/unsubscribe/demo`,
        },
        plan: { date: "воскресенье, 13 апреля" },
        brand: { name: "mamaGo", supportEmail },
      };
    case "empty-state":
      return {
        user: { firstName: "", fullName: "" },
        city: { name: "" },
        links: {
          homeUrl,
          verifyEmailUrl: `${homeUrl}/verify-email/demo-token`,
          resetPasswordUrl: `${homeUrl}/reset-password/demo-token`,
          unsubscribeUrl: `${homeUrl}/unsubscribe/demo`,
        },
        plan: { date: "" },
        brand: { name: "mamaGo", supportEmail },
      };
    default: {
      const neverPreset: never = preset;
      return neverPreset;
    }
  }
}
