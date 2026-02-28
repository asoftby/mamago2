import Link from "next/link";
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
              <Link href="#" className="hover:text-primary transition-colors">Cookies</Link>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-8 border-t">
          <div className="flex items-center gap-2 font-bold text-lg tracking-tight opacity-50">
            <span>mama</span>
            <span>Go</span>
          </div>
          <p className="text-sm text-muted-foreground text-center md:text-right">
            © {currentYear} mamaGo.by. All rights reserved.
          </p>
        </div>
      </Container>
    </footer>
  );
}
