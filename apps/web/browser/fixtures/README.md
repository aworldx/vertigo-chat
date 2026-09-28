# Player fixture

`player.webm` is a generated 12-second test pattern with a sine tone, used only
by the intercepted media routes in `player-verification.ts`. No third-party media.

Reproduce with FFmpeg:

```sh
ffmpeg -f lavfi -i 'testsrc2=size=320x240:rate=10' \
  -f lavfi -i 'sine=frequency=220:sample_rate=16000' -t 12 \
  -c:v libvpx -b:v 80k -c:a libopus -b:a 24k player.webm
```

The audio-only fixture is a 60-second PCM WAV generated in memory by the test.
Both fixture routes implement byte ranges so seeking tests exercise actual media.
