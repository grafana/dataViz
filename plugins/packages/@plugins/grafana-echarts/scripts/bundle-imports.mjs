// Finds static module dependencies without treating strings or comments as imports.
import ts from 'typescript';

/** Read actual import and re-export declarations, including those after other statements. */
export const bundleImports = (code) => {
  const source = ts.createSourceFile('renderer.js', code, ts.ScriptTarget.Latest, false, ts.ScriptKind.JS);
  return source.statements.flatMap((statement) => {
    if (!(ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement))) {
      return [];
    }
    const specifier = statement.moduleSpecifier;
    return specifier && ts.isStringLiteral(specifier) ? [specifier.text] : [];
  });
};
