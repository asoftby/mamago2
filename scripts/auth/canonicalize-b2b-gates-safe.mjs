import fs from "node:fs";

const resourceFiles = [
  "src/app/api/business/events/[id]/route.ts",
  "src/app/api/business/offers/[id]/route.ts",
  "src/app/api/business/places/[id]/improvement-requests/route.ts",
  "src/app/api/business/places/[id]/location/google/route.ts",
  "src/app/api/business/places/[id]/location/manual/route.ts",
  "src/app/api/business/places/[id]/opening-hours/route.ts",
  "src/app/api/business/places/[id]/revision/images/route.ts",
  "src/app/api/business/places/[id]/revision/opening-hours/route.ts",
  "src/app/api/business/places/[id]/route.ts",
];

const toolFiles = [
  "src/app/api/business/instagram/avatar/route.ts",
  "src/app/api/business/places/google-preview/route.ts",
  "src/app/api/business/places/location/matches/route.ts",
  "src/app/api/business/places/route.ts",
];

function removeLegacyNameFromImport(source) {
  return source.replace(
    /import\s*\{([^}]*)\}\s*from\s*["']@\/lib\/auth\/businessContentAccess["'];?/g,
    (full, body) => {
      const names = body
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean)
        .filter((name) => name !== "canCreateBusinessContent");
      if (names.length === 0) return "";
      return `import { ${names.join(", ")} } from "@/lib/auth/businessContentAccess";`;
    },
  );
}

function replaceLegacyGate(source, replacement, path) {
  const pattern = /!user\s*\|\|\s*!canCreateBusinessContent\(user\.role\)/g;
  const count = source.match(pattern)?.length ?? 0;
  if (count === 0) throw new Error(`${path}: legacy gate not found`);
  return source.replace(pattern, replacement);
}

function addImport(source, statement) {
  if (source.includes(statement)) return source;
  return `${statement}\n${source}`;
}

for (const path of resourceFiles) {
  let source = fs.readFileSync(path, "utf8");
  const hasResourceGuard =
    source.includes("canManageActivityById") ||
    source.includes("canManagePlaceAsync") ||
    source.includes("requireBusinessPermission") ||
    source.includes("checkUserBusinessPermission");
  if (!hasResourceGuard) {
    throw new Error(`${path}: no canonical resource guard; refusing edit`);
  }
  source = replaceLegacyGate(source, "!user", path);
  source = removeLegacyNameFromImport(source);
  if (source.includes("canCreateBusinessContent")) {
    throw new Error(`${path}: legacy symbol remains after transform`);
  }
  fs.writeFileSync(path, source);
}

for (const path of toolFiles) {
  let source = fs.readFileSync(path, "utf8");
  source = replaceLegacyGate(
    source,
    '!user || !(await checkBusinessToolPermission(user, "content.create"))',
    path,
  );
  source = removeLegacyNameFromImport(source);
  source = addImport(
    source,
    'import { checkBusinessToolPermission } from "@/server/permissions/business-permissions";',
  );
  if (source.includes("canCreateBusinessContent")) {
    throw new Error(`${path}: legacy symbol remains after transform`);
  }
  fs.writeFileSync(path, source);
}

console.log(`canonicalized ${resourceFiles.length + toolFiles.length} B2B API files`);
