# Daily Reward Collector (Full-Stack Automation Dashboard)

Daily Reward Collector is an automation dashboard that manages game reward profiles, schedules automated reward checking cycles, executes Selenium WebDriver login/claim sequences in the background, and visualizes trace logs and successes/failures in a glassmorphism web interface.

---

## Architecture overview
```
                             +-----------------------------------+
                             |     Frontend (React + Tailwind)   |
                             +-----------------+-----------+-----+
                                               |           ^
                                     REST APIs |           | WebSockets (Real-time logs)
                                               v           |
                             +-----------------+-----------+-----+
                             |      Backend (Flask Server)       |
                             +----+------------+-----------+-----+
                                  |            |           |
                        SQLite DB |            | Scheduler | Selenium
                                  v            v           v
                             [(Database)]   [APSched]   [Chrome] --> (Mock Site / Target)
```

---

## Tech Stack
- **Frontend**: React (Vite-scaffolded), Tailwind CSS, Recharts (visualizations), Lucide React (icons), Socket.IO-Client (real-time stream).
- **Backend**: Python Flask, Flask-CORS, Flask-SocketIO, SQLite + Flask-SQLAlchemy (ORM).
- **Automation**: Selenium WebDriver, Webdriver-Manager (driver management).
- **Security**: Cryptography (Fernet symmetric encryption for credential storage).
- **Scheduling**: APScheduler (cron/interval background cycles).

---

## Folder Structure
```
project-gamma/
├── README.md               <-- You are here
├── backend/
│   ├── app.py              <-- Flask Web Server + API Router + Mock Game Portal
│   ├── database.py         <-- DB Setup & Fernet symmetric encryption helpers
│   ├── models.py           <-- SQLAlchemy Models (Account & Log)
│   ├── scheduler.py        <-- APScheduler background loops & queue handlers
│   ├── selenium_bot.py     <-- Automation engine (Selenium / Simulator)
│   └── requirements.txt    <-- Python packages
└── frontend/
    ├── package.json        <-- NPM dependencies
    ├── tailwind.config.js  <-- Custom dark theme & glassmorphism configurations
    ├── postcss.config.js   <-- PostCSS settings for Tailwind
    ├── index.html          <-- SEO details & root div
    └── src/
        ├── index.css       <-- CSS globals, radial glow orbits, button styles
        ├── main.jsx        <-- React entrypoint
        ├── App.jsx         <-- Layout, Sidebar, Live WebSocket & Notification triggers
        ├── services/
        │   └── api.js      <-- Axios instance & SocketIO connections
        └── pages/
            ├── Dashboard.jsx <-- Stat widgets, area chart, live console stream
            ├── Accounts.jsx  <-- Card-based CRUD profiles & active toggles
            └── Logs.jsx      <-- Search/Filter datagrid, CSV exporter, failures inspector
```

---

## Features
1. **Interactive Glassmorphism UI**: High-end dark theme containing glowing radial gradients, animated statistics widgets, hover effects, and slide-in panels.
2. **Secure Credentials Storage**: Password strings are encrypted symmetrically using AES-128 via `cryptography.fernet`. A unique encryption key is auto-generated and stored in the backend `.env` file.
3. **Execution Modes (Simulation vs. Real Selenium)**:
   - **Simulation Mode** (Default): Generates synthetic automation trace runs with realistic delays, making the application instantly testable without setting up Chrome or webdriver environments.
   - **Selenium WebDriver Mode**: Launches a headless Chrome browser, executes form input, clicks buttons, and extracts reward data.
4. **Mock Target Website**: The Flask backend serves a built-in login/dashboard site at `http://localhost:5000/mock-site/login`. This functions as the direct automation target for the Chrome browser during Selenium runs, allowing users to watch a complete, real-world browser-driven collection cycle out of the box.
5. **Logs Datagrid**: Logs are paginated and searchable. Users can inspect detailed stack traces for failed collection attempts or click the download button to export results as a CSV spreadsheet.
6. **Real-time logs Console**: Real-time console logs from the Selenium automation engine stream directly to the dashboard over WebSockets.

---

## Installation & Setup

### Prerequisites
- Python 3.8+
- Node.js (npm) v16+
- Google Chrome (required *only* if running in `selenium` mode)

### 1. Backend Setup
1. Open a terminal and navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment (optional but recommended):
   ```bash
   python -m venv venv
   # On Windows (cmd/powershell):
   .\venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```
3. Install the dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Configure the environment variables in `backend/.env` (This file is generated automatically on first startup, but you can configure it manually):
   - `BOT_MODE`: Set to `simulation` (default) or `selenium` (for actual browser automation).
   - `TARGET_URL`: Set to `http://localhost:5000` (which targets the Flask server's mock website).

5. Start the backend server:
   ```bash
   python app.py
   ```
   *The Flask-SocketIO server will start on `http://localhost:5000` and automatically create the SQLite database (`daily_rewards.db`).*

### 2. Frontend Setup
1. Open a new terminal and navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install the required Node packages:
   ```bash
   npm install --legacy-peer-deps
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
   *The React development server will start on `http://localhost:5173`.*

---

## Usage Guide
1. Open your browser and navigate to the Dashboard at `http://localhost:5173`.
2. Go to the **Accounts** page, click **Add Account**, and add credentials (e.g. Username: `test@example.com`, Password: `secretpassword`).
3. If you want to simulate a login failure, add a username containing `fail_login` (e.g. `fail_login@domain.com`). If you want to simulate a collection failure, use `fail_collect` (e.g. `fail_collect@domain.com`).
4. Click **Collect Now** on the account card.
5. Navigate to the **Dashboard** page to watch the logs output in real-time in the **Live Bot Terminal**.
6. Switch the backend `.env` configuration file to `BOT_MODE=selenium` and restart the backend. Execute a run to watch real Selenium WebDriver boot, login, navigate, and claim rewards on the local mock game site!
7. Check the **Logs Archive** page to filter logs, inspect error stack traces, and click **Export CSV** to download files.
