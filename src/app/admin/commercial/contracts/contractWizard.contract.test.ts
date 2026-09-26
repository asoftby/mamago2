import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const wizard = readFileSync(
  "src/app/admin/commercial/contracts/CreateContractWizard.tsx",
  "utf8",
);
const unpField = readFileSync(
  "src/components/business/UnpLookupField.tsx",
  "utf8",
);
const route = readFileSync(
  "src/app/api/admin/commercial/contracts/route.ts",
  "utf8",
);
const schema = readFileSync("prisma/schema.prisma", "utf8");
const migration = readFileSync(
  "prisma/migrations/20260926190000_add_commercial_contract_wizard/migration.sql",
  "utf8",
);

for (const step of ["Шаблон", "Клиент", "Договор", "Услуги", "График"]) {
  assert.equal(
    wizard.includes(step),
    true,
    `contract wizard must keep the ${step} step`,
  );
}

assert.match(
  wizard,
  /const STEPS = \["Шаблон", "Клиент", "Договор", "Услуги", "График"\]/,
  "contract wizard must stay five-step; mamaGo section is implicit, not a separate step",
);

assert.match(
  wizard,
  /<UnpLookupField[\s\S]*helperText="Необязательно · проверим организацию по ЕГР"/,
  "client step must reuse the canonical UNP/EGR lookup",
);
assert.match(
  wizard,
  /<PhoneInputByMask[\s\S]*valueE164=\{phoneE164\}/,
  "client step must reuse the canonical Belarus phone mask",
);
assert.match(
  wizard,
  /platform|mamaGo\.by/,
  "wizard must make the mamaGo platform explicit without a separate selection step",
);
assert.match(
  wizard,
  /services\.length === 0[\s\S]*Добавьте хотя бы одну услугу/,
  "services step must require at least one service",
);
assert.match(
  wizard,
  /PREPAYMENT_PRESETS = \[0, 30, 50, 70, 100\]/,
  "payment schedule must keep the agreed prepayment presets",
);

assert.match(
  route,
  /requireAdminApiUser\(\)/,
  "contract creation API must remain admin-only",
);
assert.match(
  route,
  /resolveCompanyByUnp\(unp\)/,
  "contract creation must re-check a supplied UNP on the server",
);
assert.match(
  route,
  /normalizePhoneToE164\(rawPhone\)/,
  "contract creation must persist normalized E.164 phone data",
);
assert.match(
  route,
  /platform: "MAMAGO_BY"/,
  "contract creation must persist mamaGo as the fixed platform",
);
assert.match(
  route,
  /items:[\s\S]*create: normalizedItems\.map/,
  "contract creation must persist service lines",
);

assert.match(
  route,
  /Math\.abs\(value \* 100 - Math\.round\(value \* 100\)\) < 1e-8/,
  "service prices must reject sub-cent precision before Decimal(12,2) persistence",
);
assert.match(
  unpField,
  /currentValueRef\.current !== unp/,
  "UNP lookup must ignore stale async responses after the field value changes",
);
assert.match(
  wizard,
  /if \(date && !customPostpaymentDue\)[\s\S]*setPostpaymentDueAt\(addDaysIso\(date, 30\)\)/,
  "custom prepayment dates must recalculate derived postpayment while it is not manually customized",
);

assert.match(
  schema,
  /model CommercialCounterparty \{/,
  "commercial client data must not require creating a User/Business",
);
assert.match(
  schema,
  /model BusinessContractItem \{/,
  "contract services must be first-class rows",
);
assert.match(
  schema,
  /templateSource\s+ContractTemplateSource/,
  "contract must remember whose document template is used",
);
assert.match(
  schema,
  /prepaymentPercent\s+Int/,
  "contract must persist the payment schedule",
);
assert.match(
  schema,
  /platform\s+String\s+@default\("MAMAGO_BY"\)/,
  "contract platform must default to mamaGo",
);

assert.match(
  migration,
  /ALTER COLUMN "businessId" DROP NOT NULL/,
  "legacy Business-linked contracts must coexist with standalone commercial clients",
);
assert.match(
  migration,
  /CREATE TABLE "CommercialCounterparty"/,
  "migration must create the standalone commercial client table",
);

console.log("Commercial contract wizard contract: OK");
