import { createHash } from "node:crypto";
import { lstatSync, readFileSync, realpathSync, statSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

function blocked(code: string): Error {
  return new Error(`RELEASE_BLOCKED:${code}`);
}

function isWithin(root: string, candidate: string): boolean {
  const offset = relative(root, candidate);
  return offset === "" || (!offset.startsWith(`..${sep}`) && offset !== ".." && !isAbsolute(offset));
}

export interface ResolvedPhoenixArtifactRoot {
  root: string;
  files: ReadonlyMap<string, string>;
}

/** Resolve a closed set of regular files below one explicit, existing root. */
export function resolvePhoenixArtifactRoot(
  variableName: string,
  expectedRelativePaths: readonly string[],
  env: NodeJS.ProcessEnv = process.env,
): ResolvedPhoenixArtifactRoot {
  const configured = env[variableName]?.trim();
  if (!configured) throw blocked(`MISSING_${variableName}`);
  if (!isAbsolute(configured)) throw blocked(`${variableName}_MUST_BE_ABSOLUTE`);

  let root: string;
  try {
    root = realpathSync(configured);
    if (!statSync(root).isDirectory()) throw blocked(`${variableName}_NOT_DIRECTORY`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("RELEASE_BLOCKED:")) throw error;
    throw blocked(`${variableName}_UNAVAILABLE`);
  }

  const files = new Map<string, string>();
  for (const expectedPath of expectedRelativePaths) {
    if (isAbsolute(expectedPath)) throw blocked("INVALID_EXPECTED_ARTIFACT_PATH");
    const lexicalPath = resolve(root, expectedPath);
    if (!isWithin(root, lexicalPath)) throw blocked("ARTIFACT_PATH_TRAVERSAL");

    let actualPath: string;
    try {
      lstatSync(lexicalPath);
      actualPath = realpathSync(lexicalPath);
      if (!isWithin(root, actualPath)) throw blocked("ARTIFACT_SYMLINK_ESCAPE");
      if (!statSync(actualPath).isFile()) throw blocked("EXPECTED_ARTIFACT_NOT_FILE");
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("RELEASE_BLOCKED:")) throw error;
      throw blocked("EXPECTED_ARTIFACT_UNAVAILABLE");
    }
    files.set(expectedPath, actualPath);
  }
  return { root, files };
}

export function requireResolvedArtifact(
  resolvedRoot: ResolvedPhoenixArtifactRoot,
  expectedRelativePath: string,
): string {
  const path = resolvedRoot.files.get(expectedRelativePath);
  if (!path) throw blocked("UNEXPECTED_ARTIFACT_FILENAME");
  return path;
}

export function verifyPhoenixArtifactChecksum(path: string, expectedSha256: string): void {
  if (!/^[a-f0-9]{64}$/i.test(expectedSha256)) throw blocked("INVALID_ARTIFACT_SHA256");
  const actual = createHash("sha256").update(readFileSync(path)).digest("hex");
  if (actual !== expectedSha256.toLowerCase()) throw blocked("ARTIFACT_CHECKSUM_MISMATCH");
}

/** Resolve one existing regular file configured by an established file variable. */
export function resolvePhoenixArtifactFile(variableName: string, env: NodeJS.ProcessEnv = process.env): string {
  const configured = env[variableName]?.trim();
  if (!configured) throw blocked(`MISSING_${variableName}`);
  if (!isAbsolute(configured)) throw blocked(`${variableName}_MUST_BE_ABSOLUTE`);
  try {
    const actualPath = realpathSync(configured);
    if (!statSync(actualPath).isFile()) throw blocked(`${variableName}_NOT_FILE`);
    return actualPath;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("RELEASE_BLOCKED:")) throw error;
    throw blocked(`${variableName}_UNAVAILABLE`);
  }
}
