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
 *  - duplicate last path segment (e.g. gallery/gallery/file.jpg)
 *  - removal of trailing /input/ directory
 */
export function normalise_path(
  rawPath: string,
  baseDir?: string
): string {
  if (!rawPath || typeof rawPath !== "string") {
    throw new Error("normalise_path: invalid path");
  }

  let p = rawPath.trim();

  // Normalise separators
  p = p.replace(/\\/g, "/");

  // Fix macOS/Linux missing leading slash
  if (!p.startsWith("/") && (p.startsWith("Users/") || p.startsWith("home/"))) {
    p = "/" + p;
  }

  // Collapse . and ..
  p = path.normalize(p);

  /**
   * NEW: Remove trailing "input" directory
   * e.g. /dir1/dir2/input/file.jpg → /dir1/dir2/file.jpg
   */
  const parts = p.split(path.sep);

  if (parts.length >= 2) {
    const file = parts[parts.length - 1];
    const parent = parts[parts.length - 2];

    if (parent.toLowerCase() === "input") {
      parts.splice(parts.length - 2, 1); // remove "input"
      p = parts.join(path.sep);
    }
  }

   if (parts.length >= 3) {
    const file = parts[parts.length - 1];
    const parent = parts[parts.length - 2];
    const parent_upper = parts[parts.length - 3];

    if (parent_upper.toLowerCase() === "input") {
      parts.splice(parts.length - 3, 1); // remove "input"
      p = parts.join(path.sep);
    }
  }

  // If absolute and no baseDir → accept
  if (path.isAbsolute(p) && !baseDir) {
    return p;
  }

  if (baseDir) {
    const base = path.normalize(baseDir);
    const baseName = path.basename(base);

    // 0. Remove duplicate leading base directory name
    if (
      !path.isAbsolute(p) &&
      (p === baseName || p.startsWith(baseName + path.sep))
    ) {
      p = p.slice(baseName.length + 1);
    }

    // 1. If baseDir appears anywhere → anchor to it
    const idx = p.indexOf(base);
    if (idx !== -1) {
      return path.normalize(p.slice(idx));
    }

    // 2. Absolute but outside baseDir → accept
    if (path.isAbsolute(p)) {
      return p;
    }

    // 3. Relative path → resolve under baseDir
    const resolved = path.resolve(base, p);

    // Safety: ensure it didn't escape
    if (!resolved.startsWith(base + path.sep) && resolved !== base) {
      throw new Error(`Path escapes baseDir: ${rawPath}`);
    }

    return resolved;
  }

  // No baseDir, relative path → resolve against cwd
  return path.resolve(p);
}