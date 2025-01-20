import { RuleViolations } from './utils';

const targetEslintRc = (
  module: 'commonjs' | 'cjs' | 'mjs' | 'module' | 'esm' = 'commonjs'
) =>
  module === 'esm' || module === 'mjs'
    ? `
import nextEslintConfig from './eslint.next.config';

export default [
  ...nextEslintConfig,
/* <RULES> */
];
`
    : `
const nextEslintConfig = require('./eslint.next.config');

module.exports = [
  ...nextEslintConfig,
/* <RULES> */
];
`;

export function formatRules(
  rules: Record<string, RuleViolations>,
  {
    indentLevel = 6,
    type = 'error',
  }: {
    indentLevel?: number;
    type?: 'error' | 'warning';
  } = {}
): string[] {
  const icons = { error: '❌', warning: '⚠️' };

  return Array.from(Object.entries(rules))
    .sort(([ruleA, [countA, fixableA]], [ruleB, [countB, fixableB]]) => {
      // Sort by fixable (fixable first)
      if (fixableA !== fixableB) return fixableB ? 1 : -1;
      // Sort by number of issues (descending)
      if (countB !== countA) return countB - countA;
      // Sort alphabetically by rule ID
      return ruleA.localeCompare(ruleB);
    })
    .map(
      ([ruleId, [count, isFixable]]) =>
        `${' '.repeat(indentLevel)}"${ruleId}": "off", // ${
          icons[type]
        } ${count} ${type}${count > 1 ? 's' : ''}${isFixable ? ' 🛠️' : ''}`
    );
}

export function getFile(
  ruleDefinitions: {
    files: string[];
    errors: Record<string, RuleViolations>;
    warnings: Record<string, RuleViolations>;
  }[],
  { module = 'commonjs' }: { module: 'commonjs' | 'module' | 'cjs' | 'mjs' }
): string {
  const configTemplate = targetEslintRc(module);

  const formattedRules = ruleDefinitions.filter(
    ({ errors, warnings }) =>
      Object.values(errors).length > 0 || Object.values(warnings).length > 0
  );

  const formattedRuless = formattedRules
    .map(({ files, errors, warnings }) => {
      const warningLines = formatRules(warnings, { type: 'warning' });
      const errorLines = formatRules(errors);
      return `  {
        files: ${JSON.stringify(files)},
        rules: {
          // ❌ Errors: ${errorLines.length}
          ${errorLines.length ? errorLines.join('\n') : ''},
          // ⚠️ Warnings: ${warningLines.length}
          ${warningLines.length ? warningLines.join('\n') : ''}
        }
      }`;
    })
    .join(',\n');

  return configTemplate.replace('/* <RULES> */', formattedRuless);
}
