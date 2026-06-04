"use client";

import { useState, type ReactNode } from "react";
import { Share2 } from "lucide-react";
import Link from "next/link";
import { ShareModal } from "@/components/shared/ShareModal";

/* ─── Container ─────────────────────────────────────────────────────────── */

/** Универсальная оболочка боковой карточки: фон, тень, border-radius. */
export function SidebarCard({
  children,
  sticky = false,
  className,
}: {
  children: ReactNode;
  sticky?: boolean;
  className?: string;
}) {
  return (
    <div
      className={className}
      style={sticky ? { position: "sticky", top: 24 } : undefined}
    >
      <div
        style={{
          background: "#FAF7F1",
          border: "1px solid rgba(20,18,16,.10)",
          borderRadius: 20,
          padding: 24,
          boxShadow:
            "0 1px 0 rgba(255,255,255,.6) inset, 0 30px 60px -30px rgba(20,18,16,.18)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

/* ─── Section separators ─────────────────────────────────────────────────── */

/** Секция с нижним разделителем (border-bottom). */
export function SidebarCardSection({
  children,
  mb = 18,
  pb = 16,
}: {
  children: ReactNode;
  mb?: number;
  pb?: number;
}) {
  return (
    <div
      style={{
        marginBottom: mb,
        paddingBottom: pb,
        borderBottom: "1px solid rgba(20,18,16,.10)",
      }}
    >
      {children}
    </div>
  );
}

/** Секция с верхним разделителем (border-top). */
export function SidebarCardTopSection({
  children,
  mt = 14,
  pt = 14,
}: {
  children: ReactNode;
  mt?: number;
  pt?: number;
}) {
  return (
    <div
      style={{
        marginTop: mt,
        paddingTop: pt,
        borderTop: "1px solid rgba(20,18,16,.10)",
      }}
    >
      {children}
    </div>
  );
}

/* ─── Address row ────────────────────────────────────────────────────────── */

/** Строка адреса: 📍 иконка + адрес + метро. */
export function SidebarCardAddressRow({
  address,
  metro,
  district,
}: {
  address?: string;
  metro?: string;
  district?: string;
}) {
  if (!address && !metro && !district) return null;
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
      <span
        style={{
          width: 32,
          height: 32,
          flexShrink: 0,
          borderRadius: 8,
          background: "#FFE8DC",
          color: "#C24E22",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 15,
        }}
      >
        📍
      </span>
      <div style={{ minWidth: 0, fontSize: 14, color: "#3A332B" }}>
        {address && (
          <div style={{ fontWeight: 600, color: "#141210", lineHeight: 1.35 }}>
            {address}
          </div>
        )}
        {(district || metro) && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 10px", marginTop: 4, fontSize: 13, color: "#3A332B" }}>
            {district && <span><span style={{ color: "#E86A3A" }}>●</span> {district} р-н</span>}
            {metro && <span><span style={{ color: "#E86A3A" }}>●</span> ст. м. «{metro}»</span>}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Contact row ────────────────────────────────────────────────────────── */

/** Строка контакта: метка слева + ссылка справа. */
export function SidebarCardContactRow({
  label,
  href,
  value,
  external = false,
}: {
  label: string;
  href: string;
  value: string;
  external?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        fontSize: 13,
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-mono, monospace)",
          textTransform: "uppercase",
          fontSize: 11,
          letterSpacing: ".14em",
          color: "rgba(20,18,16,.55)",
        }}
      >
        {label}
      </span>
      <Link
        href={href}
        target={external ? "_blank" : undefined}
        rel={external ? "noopener noreferrer" : undefined}
        style={{
          fontWeight: 500,
          color: "#141210",
          textDecoration: "none",
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </Link>
    </div>
  );
}

/* ─── Share button ───────────────────────────────────────────────────────── */

/** Кнопка «Поделиться» — открывает ShareModal. */
export function SidebarCardShare({ title }: { title: string }) {
  const [open, setOpen] = useState(false);
  const url =
    typeof window !== "undefined" ? window.location.href : "";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          background: "none",
          border: 0,
          padding: 0,
          color: "rgba(20,18,16,.55)",
          display: "inline-flex",
          gap: 6,
          alignItems: "center",
          cursor: "pointer",
          fontFamily: "Menlo, monospace",
          fontSize: 13,
          letterSpacing: ".02em",
        }}
      >
        <Share2 size={14} /> поделиться
      </button>
      <ShareModal
        open={open}
        onOpenChange={setOpen}
        url={url}
        title={title}
      />
    </>
  );
}

/* ─── Save button ────────────────────────────────────────────────────────── */

/** Кнопка «Сохранить» с локальным toggle-состоянием. */
export function SidebarCardSave({
  saved,
  onToggle,
}: {
  saved: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        background: "none",
        border: 0,
        padding: 0,
        color: "rgba(20,18,16,.55)",
        display: "inline-flex",
        gap: 6,
        alignItems: "center",
        cursor: "pointer",
        fontFamily: "inherit",
        fontSize: 13,
      }}
    >
      <span
        style={{
          color: saved ? "#E86A3A" : "inherit",
          transform: saved ? "scale(1.15)" : "none",
          transition: "transform .25s",
          display: "inline-block",
        }}
      >
        ♥
      </span>{" "}
      Сохранить
    </button>
  );
}

/* ─── Primary button ─────────────────────────────────────────────────────── */

/** Полноширинная кнопка-ссылка (Позвонить и т.п.). */
export function SidebarCardPrimaryLink({
  href,
  label,
  variant = "outline",
}: {
  href: string;
  label: string;
  variant?: "outline" | "filled";
}) {
  return (
    <Link
      href={href}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: 52,
        borderRadius: 99,
        textDecoration: "none",
        fontWeight: 600,
        fontSize: 15,
        ...(variant === "outline"
          ? {
              border: "1px solid rgba(20,18,16,.18)",
              background: "transparent",
              color: "#141210",
            }
          : {
              border: "none",
              background: "#141210",
              color: "#FAF7F1",
            }),
      }}
    >
      {label}
    </Link>
  );
}
