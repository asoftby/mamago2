import { getTelegramDiagnostics } from "@/server/services/telegram/telegramDiagnostics.service";

async function main() {
  const diag = await getTelegramDiagnostics();
  console.log(JSON.stringify(diag, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
