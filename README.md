# 🏎️ F1 Stats Dashboard

A sleek, interactive Formula 1 statistics website that visualizes **real-time data** from the official Ergast F1 API.  
Built with HTML, CSS, and JavaScript — featuring live charts, profiles, and dynamic circuit graphics inspired by the official [Formula1.com](https://www.formula1.com).

---

## 🚀 Features

### 🧠 **Live Data Integration**
- Fetches **live driver standings**, **constructor standings**, and **race results** from the Ergast-compatible API (`https://api.jolpi.ca/ergast/f1`).
- Displays next race, season stats, and per-round leaderboards.

### 📊 **Interactive Visualizations**
- Dynamic **bar charts**, **pie charts**, and **line graphs** via Chart.js.
- Top-N filtering, sorting, and normalization options.
- Responsive and theme-aware (light/dark mode).

### 🏁 **Circuit Explorer**
- Auto-generated **interactive circuit maps** drawn via Canvas.
- Click a circuit card to open a modal with:
  - All-time winners at that track.
  - “Wins here” stats for selected drivers.
  - Track preview thumbnail.

### 👥 **Driver & Team Profiles**
- All current **drivers and constructors** displayed as rich cards.
- Each profile opens a **modal** with live Wikipedia bio summaries and key stats.
- Filter via a **global search bar** or per-section filters.

### 🎨 **Design Highlights**
- Fully responsive, grid-based layout.
- Compact metric cards and interactive charts.
- Sleek dark/light theme toggle (persists in localStorage).

---

## 🛠️ Tech Stack

| Technology | Purpose |
|-------------|----------|
| **HTML5 / CSS3** | Core layout and responsive design |
| **JavaScript (ES6)** | Dynamic interactivity & API integration |
| **Chart.js** | Data visualization |
| **Ergast / Jolpica API** | Real-time Formula 1 data source |
| **Canvas API** | Procedural circuit track rendering |
