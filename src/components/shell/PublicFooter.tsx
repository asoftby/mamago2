import Image from "next/image";
import Link from "next/link";
import { CookieSettingsFooterLink } from "@/components/shell/CookieSettingsFooterLink";
import { FooterSocialLinks } from "@/components/shell/FooterSocialLinks";
import { Container } from "@/components/ui/Container";

export function PublicFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t bg-muted/30">
      <Container className="py-12 md:py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          {/* Column 1 */}
          <div className="flex flex-col gap-4">
            <h3 className="font-semibold text-foreground">Проект</h3>
            <div className="flex flex-col gap-2 text-sm text-muted-foreground">
              <Link href="#" className="hover:text-primary transition-colors">О нас</Link>
              <Link href="#" className="hover:text-primary transition-colors">Команда</Link>
              <Link href="#" className="hover:text-primary transition-colors">Вакансии</Link>
            </div>
          </div>

          {/* Column 2 */}
          <div className="flex flex-col gap-4">
            <h3 className="font-semibold text-foreground">Партнёрам</h3>
            <div className="flex flex-col gap-2 text-sm text-muted-foreground">
              <Link href="#" className="hover:text-primary transition-colors">Добавить место</Link>
              <Link href="#" className="hover:text-primary transition-colors">Реклама</Link>
              <Link href="#" className="hover:text-primary transition-colors">Бизнес-аккаунт</Link>
            </div>
          </div>

          {/* Column 3 */}
          <div className="flex flex-col gap-4">
            <h3 className="font-semibold text-foreground">Помощь</h3>
            <div className="flex flex-col gap-2 text-sm text-muted-foreground">
              <Link href="#" className="hover:text-primary transition-colors">Поддержка</Link>
              <Link href="#" className="hover:text-primary transition-colors">Контакты</Link>
              <Link href="#" className="hover:text-primary transition-colors">FAQ</Link>
            </div>
          </div>

          {/* Column 4 */}
          <div className="flex flex-col gap-4">
            <h3 className="font-semibold text-foreground">Legal</h3>
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
