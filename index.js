const API_BASE = "https://api.open-meteo.com/v1/forecast";
const weatherContainer = document.getElementById("current-weather");
const forecastList = document.getElementById("forecast-list");
const statusMessage = document.getElementById("status-message");

window.addEventListener("DOMContentLoaded", () => {
  getUserLocation();
  setupSearch();
});

function getUserLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const city = await getCityFromCoords(latitude, longitude);
          fetchWeather(latitude, longitude, city);
        } catch {
          fetchWeather(latitude, longitude, null);
        }
      },
      (err) => {
        showStatus("Could not get your location. Please enter a city.", true);
      }
    );
  } else {
    showStatus("Geolocation is not supported in your browser.", true);
  }
}

let latestForecastData = null;
function fetchWeather(lat, lon, cityName = null) {
  showStatus("Loading weather...");
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,windspeed_10m_max,windgusts_10m_max,sunrise,sunset,weathercode&hourly=temperature_2m,relative_humidity_2m,precipitation_probability,windspeed_10m,weathercode&timezone=auto`.replace(
      /\\s+/g,
      ""
    );

  const cityTitle = document.getElementById("city-name");
  if (cityName) {
    cityTitle.textContent = cityName;
  } else {
    cityTitle.textContent = "Your location";
  }

  fetch(url)
    .then((res) => res.json())
    .then((data) => {
      hideStatus();
      latestForecastData = data;
      renderForecast(data);
      renderDayDetails(data.daily.time[0]);
    })
    .catch((err) => {
      showStatus("Failed to load weather data.", true);
      console.error(err);
    });
}

function renderForecast(data) {
  const days = data.daily;
  forecastList.innerHTML = "";

  days.time.forEach((day, i) => {
    const max = Math.round(days.temperature_2m_max[i]);
    const min = Math.round(days.temperature_2m_min[i]);
    const rain = data.daily.precipitation_sum[i];
    const rainChance = data.daily.precipitation_probability_max[i];
    const code = data.daily.weathercode[i];

    const li = document.createElement("li");
    li.innerHTML = `
        <button 
          data-day="${day}" 
          class="${i === 0 ? "active" : ""}">
          <span class="day-label">${formatDate(day)}</span>
          <span class="temps">${max}° / ${min}°</span>
          <span class="rain-chance">☔ ${Math.round(rainChance)}%</span>
        </button>
      `;

    const button = li.querySelector("button");
    button.addEventListener("click", () => {
      document
        .querySelectorAll(".forecast-list button")
        .forEach((b) => b.classList.remove("active"));
      button.classList.add("active");
      renderDayDetails(day);
    });

    forecastList.appendChild(li);
  });

  renderDayDetails(days.time[0]);
}

function renderDayDetails(dayStr) {
  const details = document.getElementById("forecast-details");
  const hourly = latestForecastData?.hourly;
  if (!hourly) return;

  const hours = [];
  for (let i = 0; i < hourly.time.length; i++) {
    if (!hourly.time[i].startsWith(dayStr)) continue;

    hours.push({
      time: hourly.time[i].split("T")[1].slice(0, 5),
      temp: Math.round(hourly.temperature_2m[i]),
      humidity: hourly.relative_humidity_2m[i],
      rainChance: hourly.precipitation_probability[i],
      wind: hourly.windspeed_10m[i],
    });
  }

  details.innerHTML = `
      <h4>${formatDate(dayStr)} — Hourly Forecast</h4>
      <div class="hourly-table">
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Temp</th>
              <th>Humidity</th>
              <th>Rain %</th>
              <th>Wind</th>
            </tr>
          </thead>
          <tbody>
            ${hours
              .map(
                (h) => `
              <tr>
                <td>${h.time}</td>
                <td>${h.temp}°C</td>
                <td>${h.humidity}%</td>
                <td>${h.rainChance}%</td>
                <td>${h.wind} m/s</td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;
}

document.getElementById("close-dialog")?.addEventListener("click", () => {
  document.getElementById("forecast-dialog").close();
});

function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function showStatus(msg, isError = false) {
  statusMessage.hidden = false;
  statusMessage.querySelector("p").textContent = msg;
  statusMessage.style.color = isError ? "red" : "black";
}
function hideStatus() {
  statusMessage.hidden = true;
}

function setupSearch() {
  const form = document.getElementById("city-form");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const city = document.getElementById("city-input").value.trim();
    if (!city) return;

    showStatus("Searching city...");
    try {
      const coords = await getCoordsFromCity(city);
      fetchWeather(coords.lat, coords.lon, city);
    } catch (err) {
      showStatus("City not found.", true);
    }
  });
}

async function getCoordsFromCity(city) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
    city
  )}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data.length) throw new Error("City not found");
  return {
    lat: parseFloat(data[0].lat),
    lon: parseFloat(data[0].lon),
  };
}

async function getCityFromCoords(lat, lon) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`;
  const res = await fetch(url);
  const data = await res.json();
  return (
    data.address.city ||
    data.address.town ||
    data.address.village ||
    data.address.state
  );
}

function renderTodayDetails(data) {
  const { hourly } = data;
  if (!hourly || !hourly.time) return;

  const today = new Date().toISOString().split("T")[0];

  const todayHours = [];
  for (let i = 0; i < hourly.time.length; i++) {
    const timestamp = hourly.time[i];
    if (!timestamp.startsWith(today)) continue;

    todayHours.push({
      time: timestamp.split("T")[1],
      temp: hourly.temperature_2m[i],
      humidity: hourly.relative_humidity_2m[i],
      rainChance: hourly.precipitation_probability[i],
      wind: hourly.windspeed_10m[i],
      code: hourly.weathercode[i],
    });
  }

  if (!todayHours.length) return;

  const detailsHTML = `
      <h4 style="margin-top: 2rem;">Hourly forecast for today</h4>
      <div class="hourly-table">
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Temp</th>
              <th>Humidity</th>
              <th>Rain %</th>
              <th>Wind</th>
            </tr>
          </thead>
          <tbody>
            ${todayHours
              .map(
                (h) => `
              <tr>
                <td>${h.time}</td>
                <td>${Math.round(h.temp)}°C</td>
                <td>${h.humidity}%</td>
                <td>${h.rainChance}%</td>
                <td>${h.wind} m/s</td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;

  const container = document.getElementById("current-weather");
  container.insertAdjacentHTML("beforeend", detailsHTML);
}

const input = document.getElementById("city-input");
const suggestionsList = document.getElementById("suggestions");

let debounceTimer;
input.addEventListener("input", () => {
  const query = input.value.trim();
  clearTimeout(debounceTimer);
  if (query.length < 2) {
    suggestionsList.innerHTML = "";
    return;
  }

  debounceTimer = setTimeout(() => {
    fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        query
      )}&limit=5&addressdetails=1`
    )
      .then((res) => res.json())
      .then((data) => {
        suggestionsList.innerHTML = "";
        data.forEach((place) => {
          const li = document.createElement("li");
          const name = formatPlaceName(place);
          li.textContent = name;
          li.dataset.lat = place.lat;
          li.dataset.lon = place.lon;
          li.addEventListener("click", () => {
            input.value = name;
            suggestionsList.innerHTML = "";
            fetchWeather(place.lat, place.lon, name);
          });
          suggestionsList.appendChild(li);
        });
      });
  }, 300);
});

function formatPlaceName(place) {
  const { city, town, village, state, country } = place.address;
  return [city || town || village || state, country].filter(Boolean).join(", ");
}

document.addEventListener("click", (e) => {
  if (!e.target.closest(".autocomplete")) {
    suggestionsList.innerHTML = "";
  }
});
