import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Mail,
  TriangleAlert,
  XCircle,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth/server";
import { BusinessInviteStatusCard } from "@/components/business/team/BusinessInviteStatusCard";
import { getCurrentRequestRoutingContext } from "@/lib/routing/requestContext";
import { buildSurfaceRedirectDestination } from "@/lib/routing/surface";
import { buildAuthUrl } from "@/lib/auth/redirectTo";
import {
  acceptBusinessInvite,
  buildBusinessInviteAcceptPath,
  getBusinessInviteAcceptanceState,
  hasUserForBusinessInviteEmail,
} from "@/server/business/businessInvite.service";

type InvitePageSearchParams = {
  token?: string;
};

const SUPPORT_EMAIL = "support@mamago.by";

function buildLoginHref(params: { token: string; email: string; mode?: "register" }) {
  return buildAuthUrl({
    mode: params.mode === "register" ? "register" : "login",
    redirectTo: buildBusinessInviteAcceptPath(params.token),
    extra: {
      email: params.email,
      invite: "business-team",
      invitationToken: params.token,
    },
  });
}

function buildLogoutAction(nextHref: string) {
  return `/api/auth/logout?next=${encodeURIComponent(nextHref)}`;
}

function buildSupportHref(email?: string | null) {
  return `mailto:${email || SUPPORT_EMAIL}`;
}

export default async function BusinessInviteAcceptPage({
  searchParams,
}: {
  searchParams: Promise<InvitePageSearchParams>;
}) {
  const params = await searchParams;
  const token = params.token?.trim();

  if (!token) {
    return (
      <BusinessInviteStatusCard
        tone="error"
        icon={XCircle}
        eyebrow="Business invitation"
        title="Приглашение недействительно"
        description="Ссылка устарела или уже была использована."
        primaryAction={{ type: "link", href: "/", label: "На главную" }}
      />
    );
  }

  const state = await getBusinessInviteAcceptanceState(token);

  if (!state.ok) {
    if (state.code === "EXPIRED") {
      return (
        <BusinessInviteStatusCard
          tone="warning"
          icon={TriangleAlert}
          eyebrow="Business invitation"
          title="Срок действия приглашения истёк"
          description="Попросите владельца бизнеса отправить новое приглашение."
          primaryAction={{ type: "link", href: "/", label: "На главную" }}
        />
      );
    }

    if (state.code === "REVOKED") {
      return (
        <BusinessInviteStatusCard
          tone="error"
          icon={XCircle}
          eyebrow="Business invitation"
          title="Приглашение было отозвано"
          description="Это приглашение больше нельзя принять."
          primaryAction={{ type: "link", href: "/", label: "На главную" }}
        />
      );
    }

    return (
      <BusinessInviteStatusCard
        tone="error"
        icon={XCircle}
        eyebrow="Business invitation"
        title="Приглашение недействительно"
        description="Ссылка устарела или уже была использована."
        primaryAction={{ type: "link", href: "/", label: "На главную" }}
      />
    );
  }

  const supportHref = buildSupportHref(state.invite.invitedByEmail);
  const routing = await getCurrentRequestRoutingContext();
  const user = await getCurrentUser();

  if (!user) {
    const userExists = await hasUserForBusinessInviteEmail(state.invite.email);

    return (
      <BusinessInviteStatusCard
        tone="neutral"
        icon={Mail}
        eyebrow="Business invitation"
        title={userExists ? "Войдите, чтобы принять приглашение" : "Завершите регистрацию"}
        description={
          <>
            Это приглашение отправлено на{" "}
            <strong className="font-semibold text-[#1F1F1F] break-all">{state.invite.email}</strong>.
            {userExists
              ? " Войдите в существующий аккаунт с этим email, и мы сразу продолжим принятие приглашения."
              : " Зарегистрируйтесь с этим email, и мы сразу добавим вас в команду бизнеса."}
          </>
        }
          primaryAction={{
            type: "link",
            href: buildLoginHref({ token, email: state.invite.email, mode: userExists ? undefined : "register" }),
            label: userExists ? "Перейти ко входу" : "Зарегистрироваться",
          }}
        secondaryAction={
          userExists
            ? {
                type: "link",
                href: "/",
                label: "На главную",
              }
            : {
                type: "link",
                href: buildLoginHref({ token, email: state.invite.email }),
                label: "У меня уже есть аккаунт",
              }
        }
        helper={
          <div className="space-y-2">
            <p>Не тот email?</p>
            <Link
              href={supportHref}
              className="inline-flex items-center gap-1 font-medium text-[#EF8759] transition-colors hover:text-[#E7794A]"
            >
              Связаться с администратором
            </Link>
          </div>
        }
      />
    );
  }

  const result = await acceptBusinessInvite(user, token);

  if (!result.ok) {
    if (result.code === "EMAIL_MISMATCH") {
      const loginHref = buildLoginHref({ token, email: state.invite.email });
      return (
        <BusinessInviteStatusCard
          tone="neutral"
          icon={Mail}
          eyebrow="Business invitation"
          title="Войдите с нужным email"
          description={
            <>
              Это приглашение отправлено на{" "}
              <strong className="font-semibold text-[#1F1F1F] break-all">{state.invite.email}</strong>.
              {" "}Выйдите из текущего аккаунта и войдите с этим email, чтобы принять приглашение.
            </>
          }
          primaryAction={{
            type: "form",
            action: buildLogoutAction(loginHref),
            label: "Перейти ко входу",
          }}
          secondaryAction={{
            type: "form",
            action: buildLogoutAction("/"),
            label: "Выйти из текущего аккаунта",
          }}
          helper={
            <div className="space-y-2">
              <p>Не тот email?</p>
              <Link
                href={supportHref}
                className="inline-flex items-center gap-1 font-medium text-[#EF8759] transition-colors hover:text-[#E7794A]"
              >
                Связаться с администратором
              </Link>
            </div>
          }
        />
      );
    }

    if (result.code === "EXPIRED") {
      return (
        <BusinessInviteStatusCard
          tone="warning"
          icon={TriangleAlert}
          eyebrow="Business invitation"
          title="Срок действия приглашения истёк"
          description="Попросите владельца бизнеса отправить новое приглашение."
          primaryAction={{ type: "link", href: "/", label: "На главную" }}
        />
      );
    }

    if (result.code === "REVOKED") {
      return (
        <BusinessInviteStatusCard
          tone="error"
          icon={XCircle}
          eyebrow="Business invitation"
          title="Приглашение было отозвано"
          description="Это приглашение больше нельзя принять."
          primaryAction={{ type: "link", href: "/", label: "На главную" }}
        />
      );
    }

    return (
      <BusinessInviteStatusCard
        tone="error"
        icon={XCircle}
        eyebrow="Business invitation"
        title="Приглашение недействительно"
        description="Ссылка устарела или уже была использована."
        primaryAction={{ type: "link", href: "/", label: "На главную" }}
      />
    );
  }

  if (result.alreadyMember) {
    redirect(
      buildSurfaceRedirectDestination({
        targetSurface: "business",
        targetPath: "/team?invite=already-member",
        ...routing,
      }),
    );
  }

  redirect(
    buildSurfaceRedirectDestination({
      targetSurface: "business",
      targetPath: "/team?invite=accepted",
      ...routing,
    }),
  );
}
