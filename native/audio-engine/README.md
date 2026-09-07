# 4ang Audio Engine

Native C++ audio analysis engine for the 4ang music platform.

## Overview

The 4ang Audio Engine provides high-performance audio analysis capabilities:

- **Waveform generation** — Peak envelope visualization
- **Loudness analysis** — ITU-R BS.1770 simplified LUFS
- **Spectral analysis** — FFT-based features (centroid, bandwidth, rolloff, flatness)
- **Tempo estimation** — BPM detection with confidence
- **Beat detection** — Onset timestamps
- **Audio features** — Unified feature vector for ML pipelines
- **Silence detection** — Leading, trailing, and internal silence

## Architecture

```
Audio Input
    ↓
AudioBuffer
    ↓
┌─────────────────────────────────────┐
│           AudioAnalyzer             │
├─────────┬─────────┬─────────┬──────┤
│Waveform │Loudness │Spectrum │ BPM  │
└─────────┴─────────┴─────────┴──────┘
    ↓
AudioFeatures
    ↓
JSON / C API / TypeScript
```

## Building

### Prerequisites

- CMake 3.20+
- C++20 compatible compiler (MSVC, GCC, Clang)

### Build Commands

```bash
# Configure
cd native/audio-engine
cmake -B build -DCMAKE_BUILD_TYPE=Release

# Build
cmake --build build --config Release

# Run tests
ctest --test-dir build -C Release --output-on-failure

# Run analyzer
./build/fourang-analyzer --sine 440 --duration 1.0 --json
```

### Windows (PowerShell)

```powershell
cd native/audio-engine
cmake -S . -B build
cmake --build build --config Release
ctest --test-dir build -C Release --output-on-failure
```

## Usage

### CLI Analyzer

```bash
# Analyze a 440 Hz sine wave
fourang-analyzer --sine 440 --duration 1.0 --json

# Analyze a 120 BPM pulse
fourang-analyzer --pulse 120 --duration 5.0 --features

# Generate white noise analysis
fourang-analyzer --noise --duration 2.0 --all --json
```

### C++ Library

```cpp
#include "fourang/analysis.hpp"

using namespace fourang;

// Create audio buffer
AudioBuffer buffer(44100, 1, 44100.0);
// ... fill with audio data ...

// Analyze
AudioAnalyzer analyzer;
auto result = analyzer.analyze(buffer);

// Access results
std::cout << "BPM: " << result.tempo.bpm << "\n";
std::cout << "LUFS: " << result.loudness.integrated_lufs << "\n";
std::string json = result.to_json();
```

### C API

```c
#include "fourang/fourang_capi.h"

fourang_buffer_t* buf = fourang_buffer_create(data, frames, channels, sr);
fourang_result_t* result;
fourang_analyze(buf, &result);
char* json = fourang_result_to_json(result);
// ... use json ...
fourang_string_free(json);
fourang_result_free(result);
fourang_buffer_free(buf);
```

## Features

### AudioFeatures

| Feature | Description | Unit |
|---------|-------------|------|
| `rms` | Root mean square | 0-1 |
| `peak` | Peak amplitude | 0-1 |
| `integrated_lufs` | Integrated loudness | LUFS |
| `true_peak_dbtp` | True peak | dBTP |
| `dynamic_range_db` | Dynamic range | dB |
| `bpm` | Beats per minute | BPM |
| `bpm_confidence` | BPM confidence | 0-1 |
| `spectral_centroid` | Spectral centroid | Hz |
| `spectral_bandwidth` | Spectral bandwidth | Hz |
| `spectral_rolloff` | Rolloff frequency | Hz |
| `spectral_flatness` | Spectral flatness | 0-1 |
| `brightness` | Brightness estimate | 0-1 |
| `energy` | Overall energy | 0-1 |
| `danceability` | Danceability proxy | 0-1 |
| `acousticness` | Acousticness proxy | 0-1 |
| `instrumentalness` | Instrumentalness proxy | 0-1 |

## Dependencies

None — the engine is self-contained with no external dependencies.

## Testing

```bash
cd native/audio-engine
cmake -B build -DFOURANG_BUILD_TESTS=ON
cmake --build build
ctest --test-dir build --output-on-failure
```

## License

Part of the 4ang platform.
