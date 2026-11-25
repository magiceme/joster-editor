import json
import re
import subprocess
import sys
from pathlib import Path


def stream_info(path):
    result = subprocess.check_output([
        "ffprobe", "-v", "error", "-show_streams", "-of", "json", str(path)
    ])
    return json.loads(result)["streams"]


def first_signal(path, kind, metadata, key, threshold):
    command = ["ffmpeg", "-hide_banner", "-i", str(path)]
    command += ["-vf", metadata, "-an"] if kind == "video" else ["-af", metadata, "-vn"]
    result = subprocess.run(command + ["-f", "null", "-"], capture_output=True, text=True, check=True)
    pattern = rf"pts_time:(-?\d+(?:\.\d+)?)\n[^\n]*{key}=(-?\d+(?:\.\d+)?)"
    return next(float(time) for time, level in re.findall(pattern, result.stderr) if float(level) > threshold)


root = Path(sys.argv[1])
for name, width, height in [("export.webm", 854, 480), ("portrait-*", 480, 854)]:
    path = next(root.glob(name))
    streams = stream_info(path)
    video = next(stream for stream in streams if stream["codec_type"] == "video")
    audio = next(stream for stream in streams if stream["codec_type"] == "audio")
    assert (video["width"], video["height"]) == (width, height)
    flash = first_signal(path, "video", "crop=iw/2:ih/5,signalstats,metadata=print:key=lavfi.signalstats.YAVG", "YAVG", 120)
    tone = first_signal(path, "audio", "asetnsamples=n=240:p=0,astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level", "RMS_level", -35)
    offset = abs(flash - tone)
    print(f"{path.name}: {video['codec_name']} + {audio['codec_name']}, {width}×{height}, "
          f"flash {flash:.3f}s, tone {tone:.3f}s, onset gap {offset * 1000:.0f} ms")
    assert offset <= .15, "flash and tone diverged by over 150 ms"
