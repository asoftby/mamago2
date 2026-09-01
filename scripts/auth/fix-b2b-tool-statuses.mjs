import fs from "node:fs";

function replaceOnce(source, from, to, path, label) {
  const index = source.indexOf(from);
  if (index < 0) throw new Error(`${path}: ${label} pattern not found`);
  if (source.indexOf(from, index + 1) >= 0) throw new Error(`${path}: ${label} pattern is ambiguous`);
  return source.slice(0, index) + to + source.slice(index + from.length);
}

const placesPath = "src/app/api/business/places/route.ts";
let places = fs.readFileSync(placesPath, "utf8");
const combined = `if (!user || !(await checkBusinessToolPermission(user, "content.create"))) {\n      return NextResponse.json({ error: "UNAUTHORIZED", message: "Authentication required" }, { status: 401 });\n    }`;
places = replaceOnce(
  places,
  combined,
  `if (!user) {\n      return NextResponse.json({ error: "UNAUTHORIZED", message: "Authentication required" }, { status: 401 });\n    }\n    if (!(await checkBusinessToolPermission(user, "content.create"))) {\n      return NextResponse.json({ error: "FORBIDDEN", message: "Business content access required" }, { status: 403 });\n    }`,
  placesPath,
  "POST auth",
);
const getCombined = `if (!user || !(await checkBusinessToolPermission(user, "content.create"))) {\n      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });\n    }`;
places = replaceOnce(
  places,
  getCombined,
  `if (!user) {\n      return NextResponse.json({ error: "Authentication required" }, { status: 401 });\n    }\n    if (!(await checkBusinessToolPermission(user, "business.view"))) {\n      return NextResponse.json({ error: "Forbidden" }, { status: 403 });\n    }`,
  placesPath,
  "GET auth",
);
fs.writeFileSync(placesPath, places);

for (const path of [
  "src/app/api/business/instagram/avatar/route.ts",
  "src/app/api/business/places/google-preview/route.ts",
  "src/app/api/business/places/location/matches/route.ts",
]) {
  let source = fs.readFileSync(path, "utf8");
  const pattern = /if \(!user \|\| !\(await checkBusinessToolPermission\(user, "content\.create"\)\)\) \{\n\s*return NextResponse\.json\(\{ error: "Unauthorized" \}, \{ status: 401 \}\);\n\s*\}/;
  const match = source.match(pattern);
  if (!match) throw new Error(`${path}: combined auth pattern not found`);
  source = source.replace(
    pattern,
    `if (!user) {\n      return NextResponse.json({ error: "Authentication required" }, { status: 401 });\n    }\n    if (!(await checkBusinessToolPermission(user, "content.create"))) {\n      return NextResponse.json({ error: "Forbidden" }, { status: 403 });\n    }`,
  );
  fs.writeFileSync(path, source);
}

console.log("B2B tool auth semantics fixed");
