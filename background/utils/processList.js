// create an array from fetched data
export function sortedList(data) {
  const animeList = [];
  data.MediaListCollection.lists.forEach(list => {
    list.entries.forEach(entry => {
      animeList.push({
        status: list.name,
        title: entry.media.title.native,
        score: entry.score,
        episodes: entry.media.episodes,
        season: `${entry.media.season} ${entry.media.seasonYear}`
      });
    });
  });
  return animeList.sort((a, b) => b.score - a.score);
}

export function scoreList(list, watching = 0, planning = 0) {
  const scoreList = list.reduce((acc, list) => {
    if (list.status === "Completed") {
      acc[list.score] = (acc[list.score] || 0) + 1;
    } else if (watching === 1 && list.status === "Watching") {
      acc[list.score] = (acc[list.score] || 0) + 1;
    } else if (planning === 1 && list.status === "Planning") {
      acc[list.score] = (acc[list.score] || 0) + 1;
    }
    return acc;
  }, {});
  return scoreList;
}
