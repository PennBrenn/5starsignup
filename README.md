# 5Star Flex/Support Auto-Register

A Chrome extension that automatically signs you up for flex sessions on 5starstudents.com — no API, no scripts to run, just click and go.

---

## What It Does

- Scans upcoming sections
- Finds selected teacher
- Signs up for said teachter
- Skips at capacity teachers
- Logs every action in real time
- Skips and dosent overwirte past sign ups

---

### How to download

1. Click the green **`<> Code`** button at the top of this GitHub page
2. Select **Download ZIP**
3. Once downloaded, unzip the file:
   - **Windows🤢:** Right-click the ZIP → **Extract All**
   - **Mac🤢:** Double-click the ZIP file
   - **Linux🥹:**
4. Open the extracted folder and find the **`flex-extension`** subfolder inside (it contains `manifest.json`)

---

### Step 2 — Load it into Chrome

1. Open Chrome and paste this into your address bar:
   ```
   chrome://extensions
   ```
2. In the **top-right corner**, turn on the **Developer Mode** toggle

   > This allows loading extensions from your computer instead of the Chrome Web Store. It is safe and standard for personal-use extensions.

3. Click **Load unpacked** (appears top-left after enabling Developer Mode)
4. In the file picker, navigate to and select the **`flex-extension`** folder
5. Click **Select Folder**

   ✅ The extension is now installed and should appear in the list.

---

### Step 3 — Pin to toolbar *(recommended)*

1. Click the 🧩 **puzzle piece** icon in the top-right of Chrome
2. Find **5Star Flex Auto-Register** in the dropdown
3. Click the 📌 **pin icon** next to it
4. The ⚡ icon will now show permanently in your toolbar for easy access

---

## Usage

1. Navigate to [5starstudents.com/agourahighschool/login](https://5starstudents.com/agourahighschool/login)
2. Sign in with your Google account (`@student.lvusd.org`)
3. Once on the dashboard, click the ⚡ extension icon in the toolbar
4. Enter your **target teacher's last name** (e.g. `Redmond`) — partial match, case-insensitive
5. Toggle **Tuesday** and/or **Wednesday** on or off as needed
6. Click **▶ Run Auto-Register**
7. Watch the activity log — it will tell you exactly what happened for each date

Your teacher name and day preferences are saved automatically between sessions.

---

## File Structure

```
flex-extension/
├── manifest.json     # Extension config and permissions
├── popup.html        # The UI shown when you click the toolbar icon
├── popup.js          # Handles UI interactions and settings persistence
├── content.js        # Core automation — runs on 5starstudents.com
├── icon16.png        # Toolbar icon (small)
└── icon48.png        # Toolbar icon (large)
```

---

## How It Works

The extension uses a **content script** that runs inside your already-authenticated browser session — so it never needs to handle your Google login. It works by:

1. Extracting your session token from the page (present in nav links and script tags after login)
2. Fetching your **My Sign Ups** page to get all upcoming dates and already-registered sessions
3. Filtering for only Tuesday and Wednesday dates
4. For each eligible date, fetching that day's session list and searching for your target teacher
5. If found and not at capacity, sending a POST request to the sign-up endpoint
6. Logging the result of each action back to the popup

---

## Handling Edge Cases

| Situation | Behavior |
|---|---|
| Already signed up for that date | Skipped with a `[SKIP]` log |
| Teacher is at capacity | Skipped with a `[SKIP]` log |
| Teacher not found that day | Skipped with a `[SKIP]` log |
| Not logged in / token missing | Error with instructions on what to do |
| Network or fetch error | Logged as `[ERR]` and continues to next date |

---

## Notes

- You must be **signed in** before running the extension. The automation reuses your existing browser session — it does not log in for you.
- Run the extension from any page **after** login (the dashboard, My Sign Ups, etc.). The login page itself does not contain a session token.
- The extension only touches `5starstudents.com` — no data is sent anywhere else.
- Settings (teacher name, day toggles) are saved to Chrome's sync storage and persist across browser sessions.

---

## Permissions Used

| Permission | Reason |
|---|---|
| `activeTab` | Read the current tab's URL and inject the content script |
| `scripting` | Execute automation code on the page |
| `storage` | Save your teacher name and day preferences |
| `host_permissions: 5starstudents.com` | Make authenticated fetch requests using your existing session |

---

## Built With

- Vanilla JavaScript (no frameworks or dependencies)
- Chrome Extensions Manifest V3
- HTML/CSS for the popup UI

---

## License

MIT — do whatever you want with it.
