// create an array from fetched data
export function processAnimeData(data) {
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
  return animeList;
}

export function sortAnimeByScore(animeList) {
  return animeList.sort((a, b) => b.score - a.score);
}
