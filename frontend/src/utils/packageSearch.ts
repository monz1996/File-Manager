export interface SearchablePackage {
  name: string;
  folder: string;
}

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ئ/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ة/g, 'ه')
    .replace(/ـ/g, '')
    .replace(/[^a-z0-9\u00c0-\uFFFF]+/gi, ' ')
    .trim();

const levenshteinSimilarity = (left: string, right: string) => {
  if (left === right) return 1;
  if (!left || !right) return 0;

  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= right.length; column += 1) {
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1),
      );
    }
    for (let column = 0; column <= right.length; column += 1) {
      previous[column] = current[column];
    }
  }

  return 1 - previous[right.length] / Math.max(left.length, right.length);
};

export const packageMatchScore = (query: string, packageName: string, folder: string) => {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return 0;

  const name = normalize(packageName);
  const folderName = normalize(folder);
  if (name === normalizedQuery) return 1000;
  if (name.startsWith(normalizedQuery)) return 900;
  if (name.includes(normalizedQuery)) return 800;
  if (folderName === normalizedQuery) return 700;
  if (folderName.includes(normalizedQuery)) return 500;

  const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean);
  const nameTokens = name.split(/\s+/).filter(Boolean);
  const tokenScores = queryTokens.map((queryToken) => Math.max(
    ...nameTokens.map((nameToken) => {
      if (nameToken === queryToken) return 80;
      if (nameToken.startsWith(queryToken) || nameToken.includes(queryToken)) return 65;
      return levenshteinSimilarity(queryToken, nameToken) * 55;
    }),
  ));

  if (!tokenScores.length) return 0;
  const score = tokenScores.reduce((total, value) => total + value, 0) / tokenScores.length;
  return score >= 35 ? score : 0;
};

export const sortPackagesBySearch = <T extends SearchablePackage>(packages: T[], query: string) => {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return packages;

  return packages
    .map((pkg) => ({
      pkg,
      score: packageMatchScore(normalizedQuery, pkg.name, pkg.folder),
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.pkg.name.localeCompare(right.pkg.name))
    .map((item) => item.pkg);
};
