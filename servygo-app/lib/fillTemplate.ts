/** Replaces `{key}` placeholders in a translation-style template string. */
export function fillTemplate(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce((acc, [k, v]) => acc.replaceAll(`{${k}}`, v), template);
}
