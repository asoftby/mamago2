import Link from "next/link";
import {
  getPublicSocialLinks,
  type PublicSocialKey,
} from "@/lib/site/publicSocialLinks";
import { cn } from "@/lib/utils";

const TIKTOK_MASK_ID = "mamago-footer-tiktok-mask";

const ARIA: Record<PublicSocialKey, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  telegram: "Telegram",
};

/** Instagram — контур + SMIL-анимация (как в переданном макете). */
function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      className={cn(className)}
      aria-hidden
    >
      <g
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      >
        <path
          strokeDasharray={66}
          strokeDashoffset={66}
          d="M16 3c2.76 0 5 2.24 5 5v8c0 2.76 -2.24 5 -5 5h-8c-2.76 0 -5 -2.24 -5 -5v-8c0 -2.76 2.24 -5 5 -5h4Z"
        >
          <animate
            fill="freeze"
            attributeName="stroke-dashoffset"
            dur="0.6s"
            values="66;0"
          />
        </path>
        <path
          strokeDasharray={28}
          strokeDashoffset={28}
          d="M12 8c2.21 0 4 1.79 4 4c0 2.21 -1.79 4 -4 4c-2.21 0 -4 -1.79 -4 -4c0 -2.21 1.79 -4 4 -4"
        >
          <animate
            fill="freeze"
            attributeName="stroke-dashoffset"
            begin="0.7s"
            dur="0.6s"
            to="0"
          />
        </path>
      </g>
      <circle cx={17} cy={7} r={1.5} fill="currentColor" opacity={0}>
        <animate
          fill="freeze"
          attributeName="opacity"
          begin="1.3s"
          dur="0.2s"
          to="1"
        />
      </circle>
    </svg>
  );
}

/** TikTok — заливка через mask + SMIL (как в переданном макете). */
function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={24}
      height={24}
      viewBox="0 0 24 24"
      className={cn(className)}
      aria-hidden
    >
      <defs>
        <mask id={TIKTOK_MASK_ID}>
          <path
            fill="#fff"
            d="M16.6 5.82c-0.68 -0.78 -1.06 -1.78 -1.06 -2.82h-3.09v12.4c-0.02 0.67 -0.31 1.31 -0.79 1.77c-0.48 0.47 -1.13 0.73 -1.8 0.73c-1.42 0 -2.6 -1.16 -2.6 -2.6c0 -1.72 1.66 -3.01 3.37 -2.48v-3.16c-3.45 -0.46 -6.47 2.22 -6.47 5.64c0 3.33 2.76 5.7 5.69 5.7c3.14 0 5.69 -2.55 5.69 -5.7v-6.29c1.25 0.9 2.76 1.38 4.3 1.38v-3.09c0 0 -1.88 0.09 -3.24 -1.48Z"
          />
          <g
            fill="none"
            stroke="#000"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={4}
          >
            <path
              strokeDasharray={36}
              strokeDashoffset={72}
              d="M11 11h-1c-2.21 0 -4.5 1.79 -4.5 4c0 2.21 1.5 4.5 4.5 4.5c2.21 0 4 -2.29 4 -4.5v-12.5"
            >
              <animate
                fill="freeze"
                attributeName="stroke-dashoffset"
                dur="0.6s"
                values="72;36"
              />
            </path>
            <path strokeDasharray={10} strokeDashoffset={20} d="M18 2.5v8">
              <animate
                fill="freeze"
                attributeName="stroke-dashoffset"
                begin="0.5s"
                dur="0.1s"
                to="10"
              />
            </path>
          </g>
        </mask>
      </defs>
      <path
        fill="currentColor"
        d="M0 0h24v24H0z"
        mask={`url(#${TIKTOK_MASK_ID})`}
      />
    </svg>
  );
}

/** Telegram — контур с SMIL-анимацией обводки (как в макете). */
function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      className={cn(className)}
      aria-hidden
    >
      <g
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      >
        <path strokeDasharray="18" d="M21 5l-2.5 15M21 5l-12 8.5">
          <animate
            fill="freeze"
            attributeName="stroke-dashoffset"
            dur="0.4s"
            values="18;0"
          />
        </path>
        <path strokeDasharray="24" d="M21 5l-19 7.5">
          <animate
            fill="freeze"
            attributeName="stroke-dashoffset"
            dur="0.4s"
            values="24;0"
          />
        </path>
        <path strokeDasharray="14" strokeDashoffset="14" d="M18.5 20l-9.5 -6.5">
          <animate
            fill="freeze"
            attributeName="stroke-dashoffset"
            begin="0.4s"
            dur="0.3s"
            to="0"
          />
        </path>
        <path strokeDasharray="10" strokeDashoffset="10" d="M2 12.5l7 1">
          <animate
            fill="freeze"
            attributeName="stroke-dashoffset"
            begin="0.4s"
            dur="0.3s"
            to="0"
          />
        </path>
        <path strokeDasharray="8" strokeDashoffset="8" d="M12 16l-3 3M9 13.5l0 5.5">
          <animate
            fill="freeze"
            attributeName="stroke-dashoffset"
            begin="0.7s"
            dur="0.3s"
            to="0"
          />
        </path>
      </g>
    </svg>
  );
}

const iconClass = "h-5 w-5";

export function FooterSocialLinks() {
  const links = getPublicSocialLinks();

  return (
    <nav
      className="flex items-center justify-center gap-1.5"
      aria-label="Мы в соцсетях"
    >
      {links.map(({ key, href }) => (
        <Link
          key={key}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label={ARIA[key]}
        >
          {key === "instagram" && <InstagramIcon className={iconClass} />}
          {key === "tiktok" && <TikTokIcon className={iconClass} />}
          {key === "telegram" && <TelegramIcon className={iconClass} />}
        </Link>
      ))}
    </nav>
  );
}
