import Image from "next/image";
import Link from "next/link";
import { CookieSettingsFooterLink } from "@/components/shell/CookieSettingsFooterLink";
import { FooterSocialLinks } from "@/components/shell/FooterSocialLinks";
import {
  FOOTER_META_TEXT_CLASS,
  FooterPrimaryNavigation,
} from "@/components/shell/FooterPrimaryNavigation";
import { Container } from "@/components/ui/Container";
import { cn } from "@/lib/utils";

/** Высота PlaceStickyActionBar / EventStickyActionBar mobile + 45px зазор до копирайта */
const STICKY_CTA_FOOTER_PAD =
  "pb-[calc(46px+1.25rem+45px+env(safe-area-inset-bottom))]";

/** Заголовок колонки — служебная метка в стиле категории на карточке события (mono, uppercase). Контраст ≥ 4.5:1 на #F6F2EA. */
const FOOTER_HEADING_CLASS =
  "font-mono text-[12px] font-medium uppercase tracking-[0.1em] text-[rgba(20,18,16,0.68)]";

/** Ссылка колонки — главный текст: sans 15px, тёмнее серого, hover-подчёркивание, focus-ring, цель ≥ 44px на мобильном. */
const FOOTER_LINK_CLASS =
  "flex min-h-11 items-center rounded-sm text-[15px] leading-[1.35] text-[#3A332B] transition-colors md:min-h-0 " +
  "hover:text-[#141210] hover:underline hover:underline-offset-4 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[#F6F2EA]";

type PublicFooterProps = {
  /** Детальная страница со sticky CTA снизу — ровно 45px между копирайтом и баром */
  withStickyCtaClearance?: boolean;
};

export function PublicFooter({ withStickyCtaClearance = false }: PublicFooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t bg-[#F6F2EA]">
      <Container
        className={cn(
          "pt-12 md:pt-16",
          withStickyCtaClearance
            ? cn(STICKY_CTA_FOOTER_PAD, "lg:pb-16")
            : "pb-4 md:pb-16",
        )}
      >
        <nav aria-label="Футер" className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          {/* Column 1 */}
          <div className="flex flex-col gap-3.5">
            <h2 className={FOOTER_HEADING_CLASS}>Проект</h2>
            <div className="flex flex-col md:gap-2.5">
              <a
                href="https://probusiness.io/experience/12467-bylo-mnogo-oshibok-noluchshe-delat-chem-sidet-nameste-ichego-to-zhdat-muzh-izhena-poshli-protiv-mass-marketa-irazvivayut-biznes-nasemeynom-dosuge.html"
                target="_blank"
                rel="nofollow noopener noreferrer"
                className={FOOTER_LINK_CLASS}
              >
                О нас
              </a>
            </div>
          </div>

          {/* Column 2 */}
          <div className="flex flex-col gap-3.5">
            <h2 className={FOOTER_HEADING_CLASS}>Партнёрам</h2>
            <div className="flex flex-col md:gap-2.5">
              <Link href="/business/onboarding" className={FOOTER_LINK_CLASS}>Бизнес-аккаунт</Link>
            </div>
          </div>

          {/* Column 3 */}
          <div className="flex flex-col gap-3.5">
            <h2 className={FOOTER_HEADING_CLASS}>Помощь</h2>
            <div className="flex flex-col md:gap-2.5">
              <a
                href="https://t.me/shapovalovalexey"
                target="_blank"
                rel="noopener noreferrer"
                className={FOOTER_LINK_CLASS}
              >
                Сообщить о проблеме
              </a>
            </div>
          </div>

          {/* Column 4 */}
          <div className="flex flex-col gap-3.5">
            <h2 className={FOOTER_HEADING_CLASS}>Информация</h2>
            <div className="flex flex-col md:gap-2.5">
              <Link href="#" className={FOOTER_LINK_CLASS}>Политика конфиденциальности</Link>
              <Link href="#" className={FOOTER_LINK_CLASS}>Пользовательское соглашение</Link>
              <CookieSettingsFooterLink className={FOOTER_LINK_CLASS} />
            </div>
          </div>
        </nav>

        {/* Bottom: строка 1 — лого слева, соцсети справа; строка 2 — копирайт по центру */}
        <div className="flex flex-col gap-2 pt-8 border-t">
          <div className="flex w-full flex-col items-center gap-3 min-[769px]:grid min-[769px]:grid-cols-[1fr_auto_1fr]">
            <Image
              src="/logomamago.webp"
              alt="mamaGo"
              width={176}
              height={44}
              className="h-[1.925rem] w-auto shrink-0 min-[769px]:justify-self-start"
              priority={false}
            />
            <FooterPrimaryNavigation />
            <div className="flex shrink-0 justify-center min-[769px]:justify-self-end">
              <FooterSocialLinks />
            </div>
          </div>
          <p className={cn("w-full text-center", FOOTER_META_TEXT_CLASS)}>
            © {currentYear} made in Belarus with 🧡
          </p>
        </div>
      </Container>
    </footer>
  );
}
