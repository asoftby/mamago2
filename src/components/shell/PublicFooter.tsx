import Image from "next/image";
import Link from "next/link";
import { CookieSettingsFooterLink } from "@/components/shell/CookieSettingsFooterLink";
import { FooterSocialLinks } from "@/components/shell/FooterSocialLinks";
import { Container } from "@/components/ui/Container";
import { cn } from "@/lib/utils";

/** Высота PlaceStickyActionBar / EventStickyActionBar mobile + 45px зазор до копирайта */
const STICKY_CTA_FOOTER_PAD =
  "pb-[calc(46px+1.25rem+45px+env(safe-area-inset-bottom))]";

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
            : "pb-12 md:pb-16",
        )}
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          {/* Column 1 */}
          <div className="flex flex-col gap-4">
            <h3 className="text-foreground" style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 18 }}>Проект</h3>
            <div className="flex flex-col gap-2 text-sm text-muted-foreground">
              <a
                href="https://probusiness.io/experience/12467-bylo-mnogo-oshibok-noluchshe-delat-chem-sidet-nameste-ichego-to-zhdat-muzh-izhena-poshli-protiv-mass-marketa-irazvivayut-biznes-nasemeynom-dosuge.html"
                target="_blank"
                rel="nofollow noopener noreferrer"
                className="hover:text-primary transition-colors"
              >
                О нас
              </a>
            </div>
          </div>

          {/* Column 2 */}
          <div className="flex flex-col gap-4">
            <h3 className="text-foreground" style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 18 }}>Партнёрам</h3>
            <div className="flex flex-col gap-2 text-sm text-muted-foreground">
              <Link href="/business/onboarding" className="hover:text-primary transition-colors">Бизнес-аккаунт</Link>
            </div>
          </div>

          {/* Column 3 */}
          <div className="flex flex-col gap-4">
            <h3 className="text-foreground" style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 18 }}>Помощь</h3>
            <div className="flex flex-col gap-2 text-sm text-muted-foreground">
              <a
                href="https://t.me/shapovalovalexey"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary transition-colors"
              >
                Сообщить о проблеме
              </a>
            </div>
          </div>

          {/* Column 4 */}
          <div className="flex flex-col gap-4">
            <h3 className="text-foreground" style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 18 }}>Информация</h3>
            <div className="flex flex-col gap-2 text-sm text-muted-foreground">
              <Link href="#" className="hover:text-primary transition-colors">Политика конфиденциальности</Link>
              <Link href="#" className="hover:text-primary transition-colors">Пользовательское соглашение</Link>
              <CookieSettingsFooterLink />
            </div>
          </div>
        </div>

        {/* Bottom: строка 1 — лого слева, соцсети справа; строка 2 — копирайт по центру */}
        <div className="flex flex-col gap-4 pt-8 border-t">
          <div className="flex w-full items-center justify-between gap-4">
            <Image
              src="/logomamago.webp"
              alt="mamaGo"
              width={176}
              height={44}
              className="h-[1.925rem] w-auto shrink-0"
              priority={false}
            />
            <div className="flex shrink-0 justify-end">
              <FooterSocialLinks />
            </div>
          </div>
          <p className="w-full text-center text-sm text-muted-foreground">
            © {currentYear} made in Belarus with 🧡
          </p>
        </div>
      </Container>
    </footer>
  );
}
