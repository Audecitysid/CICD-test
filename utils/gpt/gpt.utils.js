const openSearchText = ({ searchText, country, language, examples }) => {
  return `1. Users entry “${searchText}”
2. 3 users example keywords “${examples[0]}” ${examples[1]} ${examples[2]}
3. ${country}
4. ${language}`;
};

function calculateYoYGrowth(monthlySearches) {
  // Sort the array by year and month to ensure correct order
  monthlySearches.sort((a, b) => {
    return a.year - b.year || a.month - b.month;
  });

  // Calculate the sum of search volumes for the most recent 12 months
  const recentSearchVolumes = monthlySearches
    .slice(-12)
    .map((item) => item.search_volume);
  const sumRecent = recentSearchVolumes.reduce((acc, val) => acc + val, 0);
  const averageRecent = sumRecent / recentSearchVolumes.length;

  // Calculate the sum of search volumes for the preceding 12 months
  const precedingSearchVolumes = monthlySearches
    .slice(-24, -12)
    .map((item) => item.search_volume);
  const sumPreceding = precedingSearchVolumes.reduce(
    (acc, val) => acc + val,
    0
  );
  const averagePreceding = sumPreceding / precedingSearchVolumes.length;

  // Check for divide by zero scenario
  if (averagePreceding === 0) {
    return 1000;
  }

  // Calculate YoY Growth Rate
  const growthRate =
    ((averageRecent - averagePreceding) / averagePreceding) * 100;

  // Check if the growth rate is finite
  return isFinite(growthRate) ? growthRate : 1000;
}

module.exports = { openSearchText, calculateYoYGrowth };
