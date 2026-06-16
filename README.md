# BigQuery Release Notes Hub 🚀

A modern, responsive dashboard to monitor, search, filter, and share Google Cloud BigQuery updates, issues, features, and deprecations.

---

## 🌟 Key Features

* **Granular Feed Parsing:** Automatically pulls Google Cloud's official BigQuery Atom feed and segments larger multi-point updates into individual, organized cards (e.g., *Feature*, *Issue*, *Deprecation*, *Notice*, *General*).
* **Caching & Fallback Engine:** Persists structured records locally to minimize network latency and serve content offline/when the upstream Google Cloud feed is down or rate-limited.
* **Instant Filter & Search:** Real-time search matching over dates, categories, and content text, paired with dynamic category filter chips.
* **Social Composer (X / Twitter):** Composers that auto-draft update updates, check character limitations dynamically (280 characters), and provide quick hashtag suggestions.
* **Defensive CSS Styling:** Generic style fallbacks are configured so that if Google adds unrecognized release note categories to their feed, the UI elements (badges, indicator borders, tags) gracefully render using theme-integrated styling.
* **One-Click Copy:** Every card contains a "Copy Update" button that formats the type, date, and description for easy clipboard sharing.
* **Export to CSV:** A header-level "Export CSV" button outputs the currently searched and filtered cards into a spreadsheet-ready `.csv` file.
* **Light/Dark Mode Toggle:** An actions-bar button that swaps the page color palette (clean slate and blues for light theme, deep navy and violet for dark theme) instantly via CSS custom variables, caching user preference in `localStorage`.
* **Card Content Collapse ("Read More"):** Truncates long release notes vertically with a smooth bottom gradient fade and an animated toggle to keep page scrolling clean.
* **Smooth Color Transitions:** Applies fluid CSS animations over background colors, typography, borders, and card frames on theme switches.

---

## 📂 Project Structure

```
├── app.py                     # Flask backend router & RSS Parser (BeautifulSoup)
├── notes_cache.json           # Local cache file storing feed history
├── templates/
│   └── index.html             # UI layout and social modal dialogs
└── static/
    ├── css/
    │   └── styles.css         # Dark theme style guidelines & glassmorphism
    └── js/
        └── app.js             # Client state managers, handlers, and rendering
```

---

## 🛠️ Installation & Getting Started

### Prerequisites

* Python 3.8 or higher
* Pip (Python Package Installer)

### 1. Install Dependencies

Install the required backend parsing and routing libraries:

```bash
pip install flask beautifulsoup4
```

### 2. Run the Application

Launch the Flask development server:

```bash
python app.py
```

*The application automatically initializes or fetches from the local cache file ([notes_cache.json](file:///C:/Users/User/Documents/Python_Code/Antigravity-Test/notes_cache.json)) on startup.*

### 3. Access the Dashboard

Open your web browser and navigate to:
👉 **[http://localhost:5000](http://localhost:5000)**

---

## 🔄 How It Works (Sample Flow)

1. When a user clicks **"Refresh Feed"**, the client frontend triggers a request to `/api/release-notes?refresh=true`.
2. The Flask server fetches the BigQuery RSS Feed from Google, parses the XML, and utilizes `BeautifulSoup` to split feed content by `<h3>` tags.
3. The server updates the local cache file (`notes_cache.json`) and returns the parsed list of updates as JSON.
4. The client's JavaScript parses the payload, compiles unique categories, updates category tags, and renders individual cards in the DOM.
