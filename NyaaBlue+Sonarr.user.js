// ==UserScript==
// @name        NyaaBlue + Sonarr
// @description Tags the best releases on Nyaa according to https://releases.moe/ and adds a button to add to Sonarr
// @namespace   Dattebayo13
// @match       https://nyaa.si/*
// @version     1.0.0
// @author      Dattebayo13
// @icon        https://nyaa.si/static/favicon.png
// @grant       GM_xmlhttpRequest
// ==/UserScript==
//Original script by ThaUnknown

/* get best from seadex api, use api/search for the nyaa search value */

const seadexEndpoint = tinyRest(
  "https://releases.moe/api/collections/torrents/records"
);
const seadexEntryEndpoint = tinyRest(
  "https://releases.moe/api/collections/entries/records"
);

//JSON Link
const JSON_URL = "https://raw.githubusercontent.com/Kometa-Team/Anime-IDs/refs/heads/master/anime_ids.json";
const TORRENT_URL = window.location.href.replace('/view/', '/download/') + '.torrent'; // The torrent link

//Sonarr settings
const SONARR_API_KEY = ""; // Replace with your API key
const SONARR_URL = ""+"/api/v3"; // Change to Sonarr URL
const ROOT_FOLDER = ""; // Replace with your actual Sonarr anime folder

// qBittorrent settings
const QB_URL = ""; // Change to your qBittorrent WebUI URL
const QB_USERNAME = ""; // Replace with your username
const QB_PASSWORD = ""; // Replace with your password
const CATEGORY = ""; // Change to Sonarr category

// import tinyRest from 'tiny-rest'
function tinyRest(url, options = {}) {
  const baseURL = new URL(url);

  return (path = "./", data = {}) => {
    const requestURL = new URL(path, baseURL);

    for (const [key, value] of Object.entries(data))
      requestURL.searchParams.append(key, value);

    requestURL.searchParams.sort(); // sort to always have the same order, nicer for caching
    return fetch(requestURL, options);
  };
}

async function setViewBlue() {
  const infoHash = getViewHash();
  const element = document.querySelector(".container .panel");

  const collectionResponse = await seadexEntryEndpoint("", {
    filter: 'trs.infoHash?="' + infoHash + '"',
    expand: "trs",
    skipTotal: true,
  });

  const { items } = await collectionResponse.json();
  if (items?.length) {
    element?.classList.add(
      items[0].expand.trs.find((info) => info.infoHash === infoHash)?.isBest
        ? "panel-best"
        : "panel-best-alt"
    );

    const report = document.querySelector(
      "body > div > div:nth-child(1) > div.panel-footer.clearfix"
    );

    document.head.insertAdjacentHTML(
      "beforeend",
      '<style id="css_blue" type="text/css">button.btn-seadex {margin-right: 5px; color: #fff; background-color: #247fcc; border-color: #247fcc;} button.btn-seadex:hover {margin-right: 5px; color: #fff; background-color: #19578b; border-color: #19578b;} </style>'
    );

    for (const info of items) {
      const button = document.createElement("button");
      button.classList.add("btn", "btn-xs", "btn-seadex", "pull-right");
      button.textContent = "SeaDex";
      button.onclick = (e) => {
        e.preventDefault();
        e.stopImmediatePropagation();
        window.open(`https://releases.moe/${info.alID}`, "_blank")?.focus();
      };
      report?.insertAdjacentElement("beforeend", button);
    }
    addSonarrButton(items[0].alID, report);
  }
}

function addSonarrButton(anilistId, report) {
  const addButton = document.createElement("button");
  addButton.classList.add("btn", "btn-xs", "btn-seadex", "pull-right");
  addButton.textContent = "Sonarr";
  addButton.onclick = () => handleSonarrAddition(anilistId);
  report?.insertAdjacentElement("beforeend", addButton);
}

function handleSonarrAddition(anilistId) {
  if (anilistId) {
    fetchAnimeData(anilistId, (err, tvdbId) => {
      if (err) {
        console.error("Error fetching TVDB ID:", err);
      } else if (tvdbId) {
        addSeriesFromDetails(tvdbId);
        GM_xmlhttpRequest({
          method: "POST",
          url: `${QB_URL}/api/v2/auth/login`,
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          data: `username=${encodeURIComponent(
            QB_USERNAME
          )}&password=${encodeURIComponent(QB_PASSWORD)}`,
          onload: function (response) {
            if (response.responseText === "Ok.") {
              console.log("Authenticated with qBittorrent");

              // Add the torrent
              GM_xmlhttpRequest({
                method: "POST",
                url: `${QB_URL}/api/v2/torrents/add`,
                headers: {
                  "Content-Type": "application/x-www-form-urlencoded",
                },
                data: `urls=${encodeURIComponent(
                  TORRENT_URL
                )}&category=${CATEGORY}`,
                onload: function (addResponse) {
                  if (addResponse.status === 200) {
                    console.log(
                      "Torrent added successfully to qBittorrent under category:",
                      CATEGORY
                    );
                  } else {
                    alert("Failed to add torrent:", addResponse.responseText);
                  }
                },
                onerror: function (error) {
                  alert("Error adding torrent:", error);
                },
              });
            } else {
              alert(
                "Failed to authenticate with qBittorrent:",
                response.responseText
              );
            }
          },
          onerror: function (error) {
            alert("Error authenticating with qBittorrent:", error);
          },
        });
      } else {
        alert(`No TVDB ID found for AniList ID ${anilistId}`);
      }
    });
  } else {
    console.log("No AniList ID found.");
  }
}

async function setSearchBlue() {
  const infoHashList = getInfoHashItemList();

  const torrentsResponse = await seadexEndpoint("", {
    filter: infoHashList
      .map(({ infoHash }) => 'infoHash="' + infoHash + '"')
      .join("||"),
    skipTotal: true,
    perPage: 75,
  });

  const { items } = await torrentsResponse.json();

  /** @type {any[]} */
  const bestReleases = items
    .filter(({ isBest }) => isBest)
    .map(({ infoHash }) => infoHash);
  const altReleases = items
    .filter(({ isBest }) => !isBest)
    .map(({ infoHash }) => infoHash);

  for (const { element, infoHash } of infoHashList) {
    if (bestReleases.includes(infoHash)) element.classList.add("best");
    if (altReleases.includes(infoHash)) element.classList.add("best-alt");
  }
}

function getViewHash() {
  return document.querySelector("kbd")?.textContent || "";
}

function getInfoHashItemList() {
  return [...document.querySelectorAll("tbody tr")].map((element) => {
    const link = /** @type {HTMLLinkElement} */ (
      element.querySelector('td:nth-child(3) a[href*="magnet:\\?xt=urn:btih:"]')
    );
    const infoHash =
      link.href.match("magnet:\\?xt=urn:btih:([^&]*)&")?.[1] || "";
    return { element, infoHash };
  });
}

// Apply CSS for "best" and "best alt" table rows. "Best" is blue, "best alt" is orange.
document.head.insertAdjacentHTML(
  "beforeend",
  '<style id="css_blue" type="text/css">.best > td {background-color: rgba(0, 172, 255, 0.12) !important;} .best:hover > td {background-color: rgba(0, 172, 255, 0.18) !important;} .panel-best, .panel-best > .panel-heading {border-color: rgba(0, 172, 255, 0.12) !important;} .panel-best > .panel-heading {background-color: rgba(0, 172, 255, 0.12) !important;} .panel-success.panel-best > .panel-heading {color: unset;}</style>'
);
document.head.insertAdjacentHTML(
  "beforeend",
  '<style id="css_orange" type="text/css">.best-alt > td {background-color: rgba(255, 172, 0, 0.12) !important;} .best-alt:hover > td {background-color: rgba(255, 172, 0, 0.18) !important;} .panel-best-alt, .panel-best-alt > .panel-heading {border-color: rgba(255, 172, 0, 0.12) !important;} .panel-best-alt > .panel-heading {background-color: rgba(255, 172, 0, 0.12) !important;} .panel-success.panel-best-alt > .panel-heading {color: unset;}</style>'
);

if (window.location.href.match("view")) {
  setViewBlue();
} else {
  setSearchBlue();
}

function fetchSeries(callback) {
  GM_xmlhttpRequest({
    method: "GET",
    url: `${SONARR_URL}/series`,
    headers: { "X-Api-Key": SONARR_API_KEY },
    onload: function (response) {
      if (response.status === 200) {
        const seriesList = JSON.parse(response.responseText);
        if (callback) callback(seriesList);
      } else {
        console.error("Failed to fetch series:", response);
      }
    },
  });
}

function getSeriesDetails(tvdbId, callback) {
  if (!tvdbId) {
    console.error("TVDB ID is required.");
    return;
  }

  GM_xmlhttpRequest({
    method: "GET",
    url: `${SONARR_URL}/series/lookup?term=tvdb:${tvdbId}`,
    headers: { "X-Api-Key": SONARR_API_KEY },
    onload: function (response) {
      if (response.status === 200) {
        const seriesData = JSON.parse(response.responseText);
        if (seriesData.length === 0) {
          console.error("No series found for TVDB ID:", tvdbId);
          return;
        }
        if (callback) callback(seriesData[0]);
      } else {
        console.error("Failed to fetch series details:", response);
      }
    },
  });
}

function isSeriesExists(tvdbId, callback) {
  fetchSeries(function (seriesList) {
    const exists = seriesList.some((series) => series.tvdbId === tvdbId);
    callback(exists);
  });
}

function addSeries(series) {
  if (!series || !series.tvdbId) {
    console.error("Invalid series data.");
    return;
  }

  isSeriesExists(series.tvdbId, function (exists) {
    if (exists) {
      console.log(
        `Series "${series.title}" already exists in Sonarr. Skipping addition.`
      );
      return; // Skip adding if the series already exists
    }

    const payload = {
      tvdbId: series.tvdbId,
      title: series.title,
      qualityProfileId: 1, // Adjust according to your Sonarr setup
      rootFolderPath: ROOT_FOLDER,
      monitored: false, // Do not monitor the series
      seasons: series.seasons.map((season) => ({
        seasonNumber: season.seasonNumber,
        monitored: false, // Do not monitor individual seasons
      })),
      addOptions: {
        monitor: "none", // Do not monitor any episodes
        searchForMissingEpisodes: false, // Do not search for missing episodes
      },
      seriesType: "anime",
      monitorNewItems: "none",
      useSceneNumbering: true,
      seasonFolder: true
    };

    GM_xmlhttpRequest({
      method: "POST",
      url: `${SONARR_URL}/series`,
      headers: {
        "X-Api-Key": SONARR_API_KEY,
        "Content-Type": "application/json",
      },
      data: JSON.stringify(payload),
      onload: function (response) {
        if (response.status === 201) {
          console.log("Successfully added series:", series.title);
        } else {
          console.error("Failed to add series:", response);
        }
      },
    });
  });
}

function addSeriesFromDetails(tvdbId) {
  getSeriesDetails(tvdbId, function (series) {
    if (series) {
      addSeries(series);
    } else {
      console.error("Series not found in Sonarr lookup.");
    }
  });
}

function fetchAnimeData(anilistId, callback) {
  GM_xmlhttpRequest({
    method: "GET",
    url: JSON_URL,
    onload: function (response) {
      if (response.status === 200) {
        try {
          const jsonData = JSON.parse(response.responseText);
          const entry = Object.values(jsonData).find(
            (item) => item.anilist_id === anilistId
          );
          callback(null, entry ? entry.tvdb_id : null);
        } catch (e) {
          callback(e, null);
        }
      } else {
        callback(new Error("Failed to fetch data: " + response.status), null);
      }
    },
    onerror: function (error) {
      callback(error, null);
    },
  });
}
