# Joster Studio Editor v2.0 Pro Preview

Joster Studio is an offline-first multitrack video editor built from the original v1.0 HTML editor. The same browser application runs on the web and inside the Android Studio project. Project media stays on the device unless you explicitly export it.

## Install or open

- **Android 8 or newer:** Copy [Joster Studio Editor Preview APK](releases/joster-studio-editor-v2.0-preview-debug.apk) to a test device. Open it with the device's file manager and, if Android prompts, allow that file manager to install the package. The APK uses a debug signing key and is intended for testing. Allow microphone access when you choose to record a voiceover. Select media and export destinations through the Android file picker.
- **Chromebook and web:** Serve the contents of `web/` over HTTPS. Open the site in Chrome. Use the browser's installation option if available. The first online visit caches the editor. Use the same browser profile and site address to reopen local projects offline.
- **Netlify:** Extract the Netlify deployment ZIP and drop the extracted folder in Netlify's manual deploy uploader. The folder root should contain `index.html`, `sw.js` and `_headers`.
- **Local development:** From the repository root, run `python3 -m http.server 4173 --bind 127.0.0.1 --directory web` and open `http://127.0.0.1:4173/`. Keep the HTML, scripts and assets together. A local HTTP server enables browser APIs that are limited when opening a file directly.

## Open the Android Studio project

Open `android/` with Android Studio and leave the sibling `web/` folder in place. Install Android SDK Platform 35 and Build Tools 35.0.0, select a JDK 17 or 21 for Gradle and sync. Use **Run** or run `./gradlew assembleDebug` from `android/`. The build outputs `app/build/outputs/apk/debug/app-debug.apk`. A standalone cloud Linux setup is available through `scripts/cloud-setup.sh`.

## Edit and recover projects

1. Import video, audio or images, select media in the library, and use **Add Selected**.
2. Move or trim a clip with its body or edges. Use the inspector to enter exact source in and out points. Use **Clip & Mix Controls** for track assignment, speed, reverse, audio controls, and visual crossfade. Arrange crossfading clips so they overlap on different visual tracks.
3. Use the keyboard arrows to seek when focus is outside a control. Space plays or pauses, Ctrl/Cmd+S saves and Ctrl/Cmd+Z undoes. Ctrl/Cmd+Shift+Z redoes.
4. Use **Save** to commit the current recovery state, **Save as project** to create a named snapshot, or **Back up with media** to make a portable file. Use **Open** to import that backup or a v1.0 project. If a legacy project is missing media, select the original files again. Browser site data can be removed by the browser or device operator. Keep portable backups of important projects.
5. Choose **Export Video** and select aspect ratio, resolution, frame rate and format. Keep the editor visible during recording. In Chromium, codec support determines which MP4 streams are available and the editor can fall back to WebM. Android MP4 conversion uses Media3 after the browser compositing pass.

See [release notes](RELEASE_NOTES.md) and the [testing report](TESTING.md) for the preview scope.
