/**
 * pluralize a word based on count
 * @param count - the number to check
 * @param singular - the singular form of the word
 * @param plural - the plural form of the word (optional, defaults to singular + 's')
 * @returns the appropriate singular or plural form
 */
export const pluralize = (count: number, singular: string, plural?: string) => {
  return count === 1 ? singular : (plural || `${singular}s`);
};
