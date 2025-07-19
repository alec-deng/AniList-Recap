import { fetchList } from '../../background/GraphQL/fetchList.js';

export function injectStatsSlider() {
  if (!window.location.pathname.includes("/stats/anime/overview")) return;

  const chartWrap = document.querySelector('.bar-chart-wrap');
  if (!chartWrap) return;

  // Get username from URL
  const userName = window.location.pathname.split('/')[2];

  // Fetch user's anime list data
  fetchList(userName, "ANIME").then(data => {
    const mediaLists = data?.data?.MediaListCollection?.lists || [];
    const allEntries = mediaLists.flatMap(list => list.entries);

    // Extract unique years and seasons from the list
    const yearsSet = new Set();
    const seasonsSet = new Set();
    allEntries.forEach(entry => {
      if (entry.media.seasonYear) yearsSet.add(entry.media.seasonYear);
      if (entry.media.season) seasonsSet.add(entry.media.season);
    });
    const years = Array.from(yearsSet).sort((a, b) => b - a);
    const seasons = Array.from(seasonsSet);

    // Create slider UI
    const sliderContainer = document.createElement('div');
    sliderContainer.style.margin = "20px 0";

    const yearLabel = document.createElement('label');
    yearLabel.textContent = "Year: ";
    sliderContainer.appendChild(yearLabel);

    const yearSelect = document.createElement('select');
    years.forEach(y => {
      const opt = document.createElement('option');
      opt.value = y;
      opt.textContent = y;
      yearSelect.appendChild(opt);
    });
    sliderContainer.appendChild(yearSelect);

    const seasonLabel = document.createElement('label');
    seasonLabel.textContent = " Season: ";
    sliderContainer.appendChild(seasonLabel);

    const seasonSelect = document.createElement('select');
    seasons.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s;
      seasonSelect.appendChild(opt);
    });
    sliderContainer.appendChild(seasonSelect);

    chartWrap.prepend(sliderContainer);

    // Filtering logic
    yearSelect.onchange = seasonSelect.onchange = () => {
      const selectedYear = yearSelect.value;
      const selectedSeason = seasonSelect.value;
      filterChart(selectedYear, selectedSeason);
    };

    function filterChart(year, season) {
      // Filter entries by selected year and season
      const filtered = allEntries.filter(entry =>
        entry.media.seasonYear == year && entry.media.season == season
      );
      // Display scores for filtered entries
      const scores = filtered.map(entry =>
        `${entry.media.title.native}: ${entry.score}`
      ).join('\n');
      const barChart = chartWrap.querySelector('.bar-chart');
      if (barChart) {
        barChart.textContent = scores || `No anime found for ${year} ${season}`;
      }
    }

    // Initialize chart with first year/season
    if (years.length && seasons.length) {
      filterChart(years[0], seasons[0]);
    }
  });
}