"use client";

import Link from "next/link";

export interface PlaceInfoRowProps {
  name: string;
  logoUrl?: string;
  address?: string;
  district?: string;
  metro?: string;
  href?: string;
}

export function PlaceInfoRow({ name, logoUrl, address, district, metro, href }: PlaceInfoRowProps) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  const nameEl = href ? (
    <Link href={href} style={{ color: "inherit", textDecoration: "none", fontWeight: 600, lineHeight: 1.3 }}>
      {name}
    </Link>
  ) : (
    <span style={{ fontWeight: 600, lineHeight: 1.3 }}>{name}</span>
  );

  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
      {/* Circular logo */}
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 99,
          overflow: "hidden",
          flexShrink: 0,
          background: "#E86A3A",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={name}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <span
            style={{
              fontFamily: "var(--font-display, Georgia, serif)",
              fontStyle: "italic",
              fontWeight: 400,
              fontSize: 14,
              color: "#fff",
            }}
          >
            {initials}
          </span>
        )}
      </div>

      {/* Text */}
      <div style={{ minWidth: 0, fontSize: 14, color: "#141210" }}>
        {nameEl}
        {address && (
          <div style={{ marginTop: 2, fontSize: 13, color: "rgba(20,18,16,.55)", lineHeight: 1.4 }}>
            {address}
          </div>
        )}
        {(district || metro) && (
          <div style={{ marginTop: 4, display: "flex", flexWrap: "wrap", gap: "4px 10px", fontSize: 13, color: "rgba(20,18,16,.55)", lineHeight: 1.4 }}>
            {district && <span><span style={{ color: "#E86A3A" }}>●</span> {district} р-н</span>}
            {metro && <span><span style={{ color: "#E86A3A" }}>●</span> ст. м. «{metro}»</span>}
          </div>
        )}
      </div>
    </div>
  );
}
