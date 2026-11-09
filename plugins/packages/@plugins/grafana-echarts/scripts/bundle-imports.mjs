// Finds the static imports of the Renderer bundle for the `renderer.9` check of `check-renderer-bundle.mjs`.

/**
 * `import*as e from"x"`, `import{a as b}from"x"`, `import"x"` or `export*from"x"`, anywhere in the file. Not `import(`
 * or `import.meta`.
 */
const STATIC_IMPORT = /(?<![\w$.])(?:import|export)\s*(?:[\w$*{][^"';]*?from\s*)?(["'])([^"']+)\1/g;

/**
 * The specifiers of the static imports in the bundle. It reads the whole file, not only the start, so a comment or a
 * directive before the imports does not hide them. A string with the same text also matches, and fails as a non-peer.
 */
export const bundleImports = (code) => [...code.matchAll(STATIC_IMPORT)].map((match) => match[2]);
