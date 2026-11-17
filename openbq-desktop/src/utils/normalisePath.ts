import path from "node:path";

/**
 * Normalise a filesystem path coming from external tools (Docker, CLI, JSON, etc.)
 *
 * Handles:
 *  - relative paths
 *  - absolute paths
 *  - macOS/Linux paths missing leading '/'
 *  - Windows drive paths
 *  - mixed separators
 *  - duplicate baseDir prefixing
 *
 * @param rawPath   Path from external source
 * @param baseDir   Base directory to resolve against (optional)
 */
export function normalise_path(
  rawPath: string,
  baseDir?: string
): string {

  if (!rawPath || typeof rawPath !== "string") {
    throw new Error("normalise_path: invalid path input");
  }

  let p = rawPath.trim();

  // Convert Windows separators early
  p = p.replace(/\\/g, "/");

  // Fix macOS/Linux absolute paths missing leading slash
  // e.g. Users/ted/... → /Users/ted/...
  if (
    !path.isAbsolute(p) &&
    (p.startsWith("Users/") || p.startsWith("home/"))
  ) {
    p = "/" + p;
  }

  // Resolve against baseDir if still relative
  if (baseDir && !path.isAbsolute(p)) {
    p = path.resolve(baseDir, p);
  }

  // Collapse duplicate baseDir prefix
  if (baseDir) {
    const normalBase = path.normalize(baseDir);
    const normalPath = path.normalize(p);

    if (normalPath.startsWith(normalBase + path.sep + normalBase)) {
      p = normalPath.replace(
        normalBase + path.sep,
        ""
      );
    }
  }

  // Final normalisation
  p = path.normalize(p);

  return p;
}