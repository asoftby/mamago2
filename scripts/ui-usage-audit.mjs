import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const SRC_DIR = path.join(rootDir, 'src');
const OUTPUT_FILE = path.join(rootDir, 'src/app/(ui)/ui-lab/_data/usage.json');

// --- 1. Detect aliases ---
let aliases = {};
try {
  const tsConfigPath = path.join(rootDir, 'tsconfig.json');
  if (fs.existsSync(tsConfigPath)) {
    // Read raw content and use a looser parser or regex to extract paths
    // JSON.parse is failing likely due to trailing commas or comments which are valid in tsconfig but not JSON.
    // Let's use eval (dangerous but fine for local dev script) or regex.
    // Or just regex out the paths block.
    const content = fs.readFileSync(tsConfigPath, 'utf8');
    
    // Simple regex to extract paths object content
    // Looks for "paths": { ... }
    const pathsMatch = content.match(/"paths"\s*:\s*(\{[\s\S]*?\})/);
    if (pathsMatch) {
       // Try to parse just the paths object, removing comments if any inside
       const pathsStr = pathsMatch[1].replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '$1');
       // Also remove trailing commas
       const cleanPathsStr = pathsStr.replace(/,(\s*})/g, '$1');
       
       const paths = JSON.parse(cleanPathsStr);
       for (const [alias, targetArr] of Object.entries(paths)) {
          const key = alias.replace('/*', '');
          const target = targetArr[0].replace(/^\.\//, '').replace('/*', '');
          aliases[key] = target;
       }
    }
  }
} catch (e) {
  console.warn('⚠️  Could not parse tsconfig.json paths, aliases might fail.', e.message);
}

console.log('🔍 Aliases detected:', aliases);

// --- 2. File scanning helpers ---

function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.next' && file !== 'dist' && !file.startsWith('.')) {
        getAllFiles(filePath, fileList);
      }
    } else {
      if (/\.(ts|tsx|js|jsx)$/.test(file) && !file.endsWith('.d.ts')) {
        fileList.push(filePath);
      }
    }
  });
  return fileList;
}

// --- 3. Import parsing ---

// Regex to find import sources:
// import ... from "SOURCE"
// import("SOURCE")
// require("SOURCE")
// export ... from "SOURCE"
const IMPORT_REGEX = /from\s+['"]([^'"]+)['"]|import\s*\(['"]([^'"]+)['"]\)|require\s*\(['"]([^'"]+)['"]\)/g;

function getImports(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const imports = new Set();
  let match;
  while ((match = IMPORT_REGEX.exec(content)) !== null) {
    // match[1] -> from "..."
    // match[2] -> import("...")
    // match[3] -> require("...")
    const importPath = match[1] || match[2] || match[3];
    if (importPath) imports.add(importPath);
  }
  return Array.from(imports);
}

// --- 4. Resolve path ---

function resolveImport(sourceFile, importPath) {
  // 1. Alias resolution
  for (const [alias, target] of Object.entries(aliases)) {
    if (importPath.startsWith(alias)) {
      // Replace alias with relative path from root
      const relativeToSrc = importPath.replace(alias, target);
      // Construct absolute path
      // Note: target usually starts with "src/"
      return path.join(rootDir, relativeToSrc);
    }
  }

  // 2. Relative imports
  if (importPath.startsWith('.')) {
    return path.resolve(path.dirname(sourceFile), importPath);
  }

  // 3. Absolute/Package imports (ignore)
  return null;
}

function resolveFileExtension(basePath) {
  // Check exact match first
  if (fs.existsSync(basePath) && fs.statSync(basePath).isFile()) return basePath;

  const extensions = ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js', '/index.jsx'];
  for (const ext of extensions) {
    const p = basePath + ext;
    if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
  }
  return null;
}

// --- 5. Execution ---

console.log('🚀 Starting UI Usage Audit...');

const allFiles = getAllFiles(SRC_DIR);
console.log(`📂 Scanned ${allFiles.length} files.`);

// Map: TargetFile (relative to root) -> [SourceFiles (relative)...]
const usageMap = {};

// Initialize map with all files as keys (count 0)
allFiles.forEach(f => {
  const rel = path.relative(rootDir, f);
  usageMap[rel] = new Set();
});

allFiles.forEach(sourceFile => {
  const imports = getImports(sourceFile);
  imports.forEach(imp => {
    let resolvedPath = resolveImport(sourceFile, imp);
    if (resolvedPath) {
      const finalPath = resolveFileExtension(resolvedPath);
      if (finalPath) {
        const targetRel = path.relative(rootDir, finalPath);
        const sourceRel = path.relative(rootDir, sourceFile);
        
        if (usageMap[targetRel]) {
          usageMap[targetRel].add(sourceRel);
        } else {
            // Might happen if file wasn't in scan list (e.g. outside src?) or logic error
            // console.warn('Target not in source list:', targetRel);
            // Add it anyway if inside src
            if (targetRel.startsWith('src')) {
                 if (!usageMap[targetRel]) usageMap[targetRel] = new Set();
                 usageMap[targetRel].add(sourceRel);
            }
        }
      }
    }
  });
});

// --- 6. Output ---

const output = {
  generatedAt: new Date().toISOString(),
  usage: {}
};

Object.entries(usageMap).forEach(([file, importers]) => {
  output.usage[file] = {
    count: importers.size,
    examples: Array.from(importers).slice(0, 3) // Top 3 examples
  };
});

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
console.log(`✅ Usage audit complete! Data written to: ${OUTPUT_FILE}`);
