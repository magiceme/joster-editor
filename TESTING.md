# Preview testing report

## Source audit

The foundation was the uploaded 70 KB v1.0 HTML. Its web manifest and service worker were referenced but absent from the upload. The original save flow wrote IndexedDB media and localStorage metadata separately, including an unload write that could publish metadata before its media was durable. Playback and export duplicated timing calculations, and the primary monitor did not show all layers. The preview adds atomic storage and a composited viewer and uses shared speed and audio controls.

The configured GitHub checkout initially had no commits, and its origin advertised no refs. The uploaded HTML supplied the foundation.

## Verified in the cloud

- Chromium 156 on Linux, using FFmpeg-generated H.264/AAC source video containing a synchronized white flash and tone, plus a separate WAV asset.
- Browser automation imported both files, added tracks, changed clip speed, split a reverse clip and undid the split, applied EQ and enabled a noise gate, committed a local save, reopened with media after a reload, and reopened after disconnecting the browser from the network.
- A portable project backup reopened in a fresh browser context. A fake browser microphone produced a voiceover clip. The thumbnail tool saved a PNG from the monitor flow.
- A 390 px emulated touch screen imported media, added a clip by touch, showed a square program monitor, and had no page-wide horizontal overflow.
- The landscape WebM decoded as VP8/Opus at 854×480. Its flash and tone onsets differed by 18 ms in the final run.
- The portrait MP4 decoded as H.264/Opus at 480×854. Its flash and tone onsets differed by 17 ms in the final run.
- Sync figures measure one intentional marker per two-second source. Long projects, edits with many simultaneous sources, device-specific encoder behavior, and reverse visual fidelity need additional validation.

## Android

The Android Studio Gradle project built an APK signed with the Android debug key. The package manifest declares microphone access, has API 26 as its minimum, and points to the bundled Joster icon and splash theme. The APK contains the same HTML, editor script, and audio processing module used for browser validation.

The cloud instance had no attached Android device and exposed no KVM device. APK installation, Android permission prompts, native import/export, and Media3 conversion were unrun. The browser microphone test used synthetic input and does not cover Android permissions. Chromebook hardware and 720p, 1080p and 4K export quality were also unrun.

## Reproduce the browser checks

Start the local development server described in the README. In another shell, run `tests/run.sh` with Node.js, Playwright, Chromium, FFmpeg, FFprobe and Python 3 available. Set `CHROMIUM_EXECUTABLE` if Chromium is installed elsewhere. Set `JOSTER_TEST_DIR` to retain the generated fixtures and exports at a known location.
