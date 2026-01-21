# VirtualDJ Radio App

A sleek, modern web app for streaming VirtualDJ Radio's 4 channels.

## Features

- 🎵 Stream all 4 VirtualDJ Radio channels (ClubZone, Hypnotica, PowerBase, TheGrind)
- 🎧 Live DJ info - see who's currently on air with show name and profile pic
- 🎤 Real-time track metadata (artist, title)
- ❤️ Like button for tracks
- 📜 Track history
- 📅 Show schedule
- 💬 Embedded community chat
- 🎨 Dynamic theming based on selected channel
- 📱 PWA support - installable on mobile

## Local Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Deploy to Cloudflare Pages

### Option 1: Git Integration (Recommended)

1. Push this project to a GitHub/GitLab repo
2. Go to [Cloudflare Pages](https://pages.cloudflare.com/)
3. Click "Create a project" → "Connect to Git"
4. Select your repository
5. Configure build settings:
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
6. Click "Save and Deploy"

### Option 2: Direct Upload

1. Build the project locally:
   ```bash
   npm install
   npm run build
   ```

2. Go to [Cloudflare Pages](https://pages.cloudflare.com/)
3. Click "Create a project" → "Direct Upload"
4. Drag and drop the `dist` folder
5. Done!

---

## Convert to Android APK

### Step 1: Deploy to Cloudflare first
Get your live URL (e.g., `https://vdjradio.pages.dev`)

### Step 2: Generate APK with PWABuilder
1. Go to [pwabuilder.com](https://www.pwabuilder.com)
2. Enter your Cloudflare URL
3. Click "Package for stores" → Android
4. **Important:** Choose "Signed APK" (not unsigned!)
5. Set package name: `com.orbitalunderground.vdjradio`
6. Download the APK and the signing info

### Step 3: Remove URL Bar (Digital Asset Links)

By default, Android shows a URL bar at the top. To make it look fully native:

1. When you generate APK on PWABuilder, they provide your signing key fingerprint.
   Or extract it yourself:
   ```bash
   keytool -printcert -jarfile your-app.apk
   ```
   Look for the SHA-256 fingerprint.

2. Edit `public/.well-known/assetlinks.json` in this project:
   ```json
   {
     "sha256_cert_fingerprints": ["XX:XX:XX:YOUR:ACTUAL:FINGERPRINT:HERE"]
   }
   ```

3. Rebuild and redeploy to Cloudflare:
   ```bash
   npm run build
   # Upload dist folder again
   ```

4. Regenerate the APK on PWABuilder

The URL bar will now be hidden!

---

## Project Structure

```
vdjradio-cloudflare/
├── index.html
├── package.json
├── vite.config.js
├── public/
│   ├── .well-known/
│   │   └── assetlinks.json    # Android TWA verification
│   ├── icons/
│   │   ├── icon-192.png       # App icon (192x192)
│   │   └── icon-512.png       # App icon (512x512)
│   ├── apple-touch-icon.png   # iOS home screen icon
│   ├── favicon.ico            # Browser favicon
│   ├── logo.svg               # Shield logo (vector)
│   ├── manifest.json          # PWA manifest
│   └── sw.js                  # Service worker for offline
├── functions/
│   └── api/
│       └── nowplaying.js      # Cloudflare Function - fetches DJ info
└── src/
    ├── main.jsx
    └── App.jsx
```

## API Endpoints

Once deployed, the app exposes:

### GET /api/nowplaying

Returns current DJ info for all 4 channels:

```json
[
  {
    "channel": "clubzone",
    "channelName": "ClubZone",
    "isLive": true,
    "djName": "DJ Royski",
    "showName": "Club Royski",
    "djImage": "https://virtualdjradio.com/image/dj_banner/123.jpg",
    "djProfileUrl": "https://virtualdjradio.com/djs/djroyski/",
    "timestamp": "2026-01-20T12:00:00.000Z"
  },
  ...
]
```

## Stream URLs

| Channel   | URL |
|-----------|-----|
| ClubZone  | `https://virtualdjradio.com/stream/channel1.mp3` |
| TheGrind  | `https://virtualdjradio.com/stream/channel2.mp3` |
| Hypnotica | `https://virtualdjradio.com/stream/channel3.mp3` |
| PowerBase | `https://virtualdjradio.com/stream/channel4.mp3` |

## Tech Stack

- React 18
- Vite 5
- Cloudflare Pages + Functions
- PWA (Service Worker + Web Manifest)
- icecast-metadata-player (for track metadata)

## License

This is a fan project for VirtualDJ Radio. All streaming content belongs to VirtualDJ Radio and its DJs.
