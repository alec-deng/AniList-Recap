import { fetchList } from '../../background/GraphQL/fetchList.js';

export function injectSeasonalSort() {
  // Only run on animelist page
  if (!window.location.pathname.endsWith("/animelist")) return;

  console.log('test1');

  const filterGroup = document.querySelector('.filter-group');
  const groupHeader = filterGroup?.querySelector('.group-header');
  const listsContainer = document.querySelector('.lists');
  if (!filterGroup || !groupHeader || !listsContainer) return;

  // Create sorting controls
  const sortContainer = document.createElement('div');
  sortContainer.style.margin = "10px 0";

  const allSpan = document.createElement('span');
  allSpan.textContent = "All";
  allSpan.style.cursor = "pointer";
  allSpan.style.marginRight = "10px";
  allSpan.style.fontWeight = "bold";

  const seasonalSpan = document.createElement('span');
  seasonalSpan.textContent = "Seasonal";
  seasonalSpan.style.cursor = "pointer";

  sortContainer.appendChild(allSpan);
  sortContainer.appendChild(seasonalSpan);

  groupHeader.after(sortContainer);

  // Store original lists for restoration
  let originalListsHTML = listsContainer.innerHTML;

  // Get username from URL
  const userName = window.location.pathname.split('/')[2];

  // Sorting logic
  allSpan.onclick = async () => {
    allSpan.style.fontWeight = "bold";
    seasonalSpan.style.fontWeight = "normal";
    listsContainer.innerHTML = originalListsHTML;
  };

  seasonalSpan.onclick = async () => {
    allSpan.style.fontWeight = "normal";
    seasonalSpan.style.fontWeight = "bold";
    listsContainer.innerHTML = "<div>Loading...</div>";

    // Fetch list data using GraphQL API
    try {
      const data = await fetchList(userName, "ANIME");
      const mediaLists = data?.data?.MediaListCollection?.lists || [];

      // Group entries by season/year
      const seasonGroups = {};
      mediaLists.forEach(list => {
        list.entries.forEach(entry => {
          const season = entry.media.season || "Unknown";
          const year = entry.media.seasonYear || "Unknown";
          const key = `${year} ${season}`;
          if (!seasonGroups[key]) seasonGroups[key] = [];
          seasonGroups[key].push(entry);
        });
      });

      // Render grouped lists
      listsContainer.innerHTML = "";
      Object.entries(seasonGroups).forEach(([seasonKey, entries]) => {
        const wrap = document.createElement('div');
        wrap.className = "list-wrap";
        const h3 = document.createElement('h3');
        h3.className = "section-name";
        h3.textContent = seasonKey;
        wrap.appendChild(h3);

        const section = document.createElement('div');
        section.className = "list-section";
        entries.forEach(entry => {
          const item = document.createElement('div');
          item.className = "list-item";
          item.innerHTML = `
            <div class="media">
              <span class="title">${entry.media.title.native}</span>
              <span class="season">${entry.media.season || ""}</span>
              <span class="season-year">${entry.media.seasonYear || ""}</span>
              <span class="score">Score: ${entry.score}</span>
              <span class="episodes">Episodes: ${entry.media.episodes || ""}</span>
            </div>
          `;
          section.appendChild(item);
        });
        wrap.appendChild(section);
        listsContainer.appendChild(wrap);
      });
    } catch (err) {
      listsContainer.innerHTML = `<div>Error loading data.</div>`;
    }
  };
}