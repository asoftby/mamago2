import Link from "next/link";
import { Container } from "@/components/ui/Container";

export default function FreshDeploySetupNotice() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-16">
      <Container className="max-w-lg text-center">
        <h1 className="text-2xl font-semibold text-foreground">mamaGo.by</h1>
        <p className="mt-4 text-muted-foreground">
          База данных подключена, но города ещё не настроены. После первого деплоя
          выполните системный seed, чтобы создать города и справочники.
        </p>
        <pre className="mt-6 rounded-lg bg-muted px-4 py-3 text-left text-sm text-foreground">
          pnpm db:migrate:deploy{"\n"}pnpm db:seed
        </pre>
        <p className="mt-4 text-sm text-muted-foreground">
          Подробнее:{" "}
          <Link href="https://github.com/asoftby/mamago2" className="underline">
            README
          </Link>
        </p>
      </Container>
    </main>
  );
}
