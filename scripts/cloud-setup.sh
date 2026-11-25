#!/usr/bin/env bash
set -euo pipefail

repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
tools_dir="${JOSTER_TOOLCHAIN_DIR:-/workspace/joster-toolchain}"
mkdir -p "$tools_dir"
tools_dir="$(cd "$tools_dir" && pwd)"
cd "$tools_dir"

download() {
  local url="$1" file="$2" checksum="$3" algorithm="$4"
  if [[ ! -f "$file" ]]; then
    curl -fsSL --retry 2 "$url" -o "$file.part"
    mv "$file.part" "$file"
  fi
  printf '%s  %s\n' "$checksum" "$file" | "$algorithm" -c -
}

jdk_archive=OpenJDK21U-jdk_x64_linux_hotspot_21.0.8_9.tar.gz
export JAVA_HOME="$tools_dir/jdk-21.0.8+9"
if [[ ! -x "$JAVA_HOME/bin/javac" ]]; then
  download "https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.8%2B9/$jdk_archive" "$jdk_archive" f2dc5418092c43003db8f9005c4a286e1c0104fea96ccdd49e8ebd037cac9219 sha256sum
  tar -xzf "$jdk_archive"
fi

gradle_bin="$tools_dir/gradle-8.11.1/bin/gradle"
if [[ ! -x "$gradle_bin" ]]; then
  download https://downloads.gradle.org/distributions/gradle-8.11.1-bin.zip gradle.zip f397b287023acdba1e9f6fc5ea72d22dd63669d59ed4a289a29b1a76eee151c6 sha256sum
  unzip -qo gradle.zip
fi

export ANDROID_HOME="$tools_dir/sdk"
export ANDROID_USER_HOME="$tools_dir/java-user/.android"
export GRADLE_USER_HOME="$tools_dir/gradle-cache"
mkdir -p "$ANDROID_HOME/platforms" "$ANDROID_HOME/build-tools" "$ANDROID_USER_HOME"
if [[ ! -f "$ANDROID_HOME/platforms/android-35/android.jar" ]]; then
  download https://dl.google.com/android/repository/platform-35_r02.zip platform-35_r02.zip 0bb560a90a7a2cbd0dd8348224d518b638fe7949 sha1sum
  unzip -qo platform-35_r02.zip -d "$ANDROID_HOME/platforms"
fi
if [[ ! -x "$ANDROID_HOME/build-tools/35.0.0/aapt2" ]]; then
  download https://dl.google.com/android/repository/build-tools_r35_linux.zip build-tools_r35_linux.zip 2cfaa0bbb2336e9ec18ed3ecea84fa2e2af607bc sha1sum
  unzip -qo build-tools_r35_linux.zip -d "$ANDROID_HOME/build-tools"
  ln -sfn android-15 "$ANDROID_HOME/build-tools/35.0.0"
fi

joster_jvm_args="-Xmx2048m -Dfile.encoding=UTF-8 -Duser.home=$tools_dir/java-user"
if [[ -r /etc/ssl/certs/java/cacerts ]]; then
  joster_jvm_args="$joster_jvm_args -Djavax.net.ssl.trustStore=/etc/ssl/certs/java/cacerts"
fi
proxy_args=()
if [[ -n "${HTTPS_PROXY:-}" ]]; then
  mapfile -t proxy_args < <(python3 - <<'PY'
import os
from urllib.parse import urlsplit

proxy = urlsplit(os.environ['HTTPS_PROXY'])
if proxy.hostname and proxy.port:
    for protocol in ('https', 'http'):
        print(f'-D{protocol}.proxyHost={proxy.hostname}')
        print(f'-D{protocol}.proxyPort={proxy.port}')
PY
)
fi

cd "$repo/android"
if [[ $# -eq 0 ]]; then
  set -- assembleDebug
fi
exec "$gradle_bin" --no-daemon --max-workers=2 "-Dorg.gradle.jvmargs=$joster_jvm_args" "${proxy_args[@]}" "$@"
