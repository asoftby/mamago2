import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

// Child ownership checks go through the single scope helper, never parentId.
const childFiles = [
  "src/app/api/children/route.ts",
  "src/app/api/children/[id]/route.ts",
  "src/app/api/me/profile-state/route.ts",
  "src/app/api/public/bookings/camp-shift/prefill/route.ts",
  "src/app/(public)/me/page.tsx",
  "src/app/(public)/me/profile/page.tsx",
  "src/app/(public)/me/plan/page.tsx",
  "src/lib/decision/subjects.ts",
];
for (const f of childFiles) {
  const src = read(f);
  assert.match(src, /childScopeFor/, `${f} must use childScopeFor`);
  assert.doesNotMatch(src, /where:\s*\{[^}]*parentId:\s*(user\.id|input\.userId)/, `${f} must not authorize by parentId`);
}

// New children carry familyId and createdById.
const create = read("src/app/api/children/route.ts");
assert.match(create, /familyId,\s*\n\s*createdById: user\.id/);

// plan.service: no raw userId ownership, no cancelledAt, every create sets familyId.
const plan = read("src/server/services/plan.service.ts");
assert.doesNotMatch(plan, /cancelledAt/);
// Check the data of each write, including the transactional Offer path. A
// global count alone cannot prove that the fifth write carries its own family.
const planAst = ts.createSourceFile("plan.service.ts", plan, ts.ScriptTarget.Latest, true);
const expectedWriters = ["addPlanItem", "addRoutePlanItem", "addOfferPlanItem", "addPlacePlanItem", "addArticlePlanItem"];
const actualWriters: string[] = [];
const property = (object: ts.ObjectLiteralExpression, name: string) =>
  object.properties.find((p) => p.name?.getText(planAst) === name);
const valueOf = (p: ts.ObjectLiteralElementLike | undefined): ts.Expression | undefined =>
  p && ts.isPropertyAssignment(p) ? p.initializer : p && ts.isShorthandPropertyAssignment(p) ? p.name : undefined;

for (const fn of planAst.statements.filter(ts.isFunctionDeclaration)) {
  if (!fn.body || !fn.name) continue;
  const body = fn.body;
  const writer = fn.name.text;
  // Only an immutable, function-local binding derived from this caller's userId
  // can stand in for an inline await of the canonical access helper.
  const canonicalValue = (expr: ts.Expression | undefined, helper: string): boolean => {
    if (!expr) return false;
    if (ts.isIdentifier(expr)) {
      const declaration = body.statements.filter(ts.isVariableStatement)
        .filter((statement) => Boolean(statement.declarationList.flags & ts.NodeFlags.Const))
        .flatMap((statement) => [...statement.declarationList.declarations])
        .find((declaration) => declaration.name.getText(planAst) === expr.text);
      return declaration?.initializer?.getText(planAst) === `await ${helper}(userId)`;
    }
    return expr.getText(planAst) === `await ${helper}(userId)`;
  };
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && /^(prisma|tx)\.planItem\.(create|findFirst)$/.test(node.expression.getText(planAst))) {
      const args = node.arguments[0];
      assert.ok(args && ts.isObjectLiteralExpression(args), `${writer}: explicit query required`);
      if (node.expression.getText(planAst).endsWith(".create")) {
        actualWriters.push(writer);
        const data = valueOf(property(args, "data"));
        assert.ok(data && ts.isObjectLiteralExpression(data), `${writer}: explicit create data required`);
        assert.equal(valueOf(property(data, "userId"))?.getText(planAst), "userId", `${writer}: creator must be the caller`);
        assert.ok(canonicalValue(valueOf(property(data, "familyId")), "familyIdForWrite"), `${writer}: familyId must come from familyIdForWrite(userId)`);
      } else {
        const where = valueOf(property(args, "where"));
        assert.ok(where && ts.isObjectLiteralExpression(where), `${writer}: explicit dedup scope required`);
        assert.ok(where.properties.some((p) => ts.isSpreadAssignment(p) &&
          canonicalValue(ts.isParenthesizedExpression(p.expression) ? p.expression.expression : p.expression, "activePlanScopeFor")),
        `${writer}: dedup must use the caller's active family/visibility scope`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(body);
}
assert.deepEqual(actualWriters.sort(), [...expectedWriters].sort(), "all five named create paths must retain family ownership checks");
assert.match(plan, /\.\.\.\(await planScopeFor\(userId\)\)/);

// Reads default to legacy. delete-account is family-aware since B3 but is
// independent of the reads flag and never creates a family.
assert.doesNotMatch(read("src/server/account/deleteAccount.service.ts"), /ensureFamily|FAMILY_CORE_READS|familyCoreReads/);
assert.match(read("src/server/family/familyScope.ts"), /FAMILY_CORE_READS/);

// Active-state lookups (planned / in plan / dedup) must exclude CANCELLED via
// activePlanScopeFor; plain planScopeFor is reserved for ACL-only checks.
const activeStateFiles = [
  "src/server/services/plan.service.ts",
  "src/server/services/planOccurrence.service.ts",
  "src/server/services/dayScenario.service.ts",
  "src/app/api/save/status/route.ts",
  "src/app/api/save/ideas/route.ts",
  "src/app/api/plan/suggestions/route.ts",
  "src/app/api/plan/generate/route.ts",
  "src/server/ideas/loadUserIdeas.ts",
];
for (const f of activeStateFiles) {
  const src = read(f);
  assert.match(src, /activePlanScopeFor/, `${f} must use activePlanScopeFor`);
  const plainUses = (src.match(/\bplanScopeFor\(/g) ?? []).length;
  // plan.service keeps one ACL-only use (removePlanItem); dayScenario.service one
  // (setScenarioItemOverride ACL check).
  assert.equal(plainUses, f.endsWith("plan.service.ts") || f.endsWith("dayScenario.service.ts") ? 1 : 0, `${f}: unexpected plain planScopeFor`);
}
const planSvc = read("src/server/services/plan.service.ts");
const removeBody = planSvc.slice(planSvc.indexOf("export async function removePlanItem"));
assert.match(removeBody.slice(0, removeBody.indexOf("\n}\n")), /planScopeFor\(userId\)/);
// Dedup scopes (inline and function-local aliases) are verified above.
// The scenario duplicate check also ignores cancelled rows.
assert.match(read("src/app/api/plan/scenario/route.ts"), /\.\.\.activeScope, activityId: activity\.id, id: \{ not: replacement\.planItemId \}/);

console.log("familyCoreReads.contract.test.ts: OK");
