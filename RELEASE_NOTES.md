# Joster Studio Editor v2.0 Pro Preview

This preview evolves the uploaded v1.0 source. The upload contained one self-contained editor and no separate v1.1–v2.0 roadmap. The feature list in the request guided this milestone.

## Changes

- Added 0.25× to 4× clip speed, silent reverse video, speed-aware trimming and splitting, compatible track assignment, and crossfade between overlapping visual layers.
- Added bass, mid and treble EQ, clip and track pan, solo, a rumble filter, and a noise gate for quiet passages. Preview and export use the same audio processing controls.
- Added a composited program monitor, easing for motion keyframes, crossfade controls, chroma softness and green-spill reduction. Kept the original motion presets, crop, color, and artwork layers.
- Kept SRT import and export and editable live-typing captions. Added opt-in microphone dictation on browsers with a speech-recognition service. Dictation may send speech to that service.
- Added thumbnail title-size and shade controls, composited frame capture, voiceover track fallback, and configurable corner watermarks.
- Added atomic IndexedDB media and project commits, migration from the v1.0 local cache, named project snapshots, and portable backups with media.
- Added the installable offline web shell, a responsive touch layout, and an Android Studio project with a Joster launcher icon, splash, microphone permission flow, Android file pickers, and Media3 MP4 conversion.
- Export offers 480p, 720p, 1080p and 4K with landscape, portrait and square dimensions. Encoder and memory limits vary by device.

## Open work

- Automatic transcription of imported timeline audio, offline transcription, and reverse audio are pending. Live microphone dictation depends on browser support.
- Cloud synchronization and account management are pending. The editor and its local recovery workflow work without an account.
- Chroma and reverse preview use browser rendering and frame seeking. Precise reverse playback, long projects, full-resolution keying, and 4K on low-power devices need performance and quality testing.
- Android runtime installation, permission grants, multi-file import, native file saving, and H.264/AAC conversion still need a supported device or emulator. This package is a debug-signed preview.
- Earlier version binaries, project fixtures, and the detailed expansion roadmap were unavailable. Compatibility and feature preservation were assessed against the supplied v1.0 source.
