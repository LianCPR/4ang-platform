/**
 * 4ang Audio Engine — Features Implementation
 */

#include "fourang/features.hpp"
#include "fourang/loudness.hpp"
#include "fourang/spectrum.hpp"
#include "fourang/bpm.hpp"
#include "fourang/version.hpp"
#include <algorithm>
#include <cmath>

namespace fourang {

AudioFeatures Features::extract(const AudioBuffer& buffer) {
    AudioFeatures f{};

    if (buffer.empty()) {
        return f;
    }

    // ── Basic Info ──
    f.duration_seconds = buffer.duration_seconds();
    f.sample_rate = buffer.sample_rate();
    f.channels = buffer.num_channels();

    // ── Amplitude ──
    f.rms = buffer.rms();
    f.peak = buffer.peak();
    f.peak_abs = buffer.peak_abs();
    f.crest_factor = buffer.crest_factor();

    // ── Loudness ──
    auto loudness = Loudness::analyze(buffer);
    f.integrated_lufs = loudness.integrated_lufs;
    f.true_peak_dbtp = loudness.true_peak_dbtp;
    f.dynamic_range_db = loudness.dynamic_range_db;

    // ── Silence ──
    f.silence_ratio = loudness.silence_ratio;
    f.leading_silence = Loudness::leading_silence(buffer);
    f.trailing_silence = Loudness::trailing_silence(buffer);

    // ── Tempo ──
    auto bpm_result = BPM::estimate(buffer);
    f.bpm = bpm_result.bpm;
    f.bpm_confidence = bpm_result.confidence;
    f.tempo_stability = bpm_result.tempo_stability;

    // ── Spectral ──
    auto spectral = Spectrum::extract_features(buffer);
    f.spectral_centroid = spectral.centroid;
    f.spectral_bandwidth = spectral.bandwidth;
    f.spectral_rolloff = spectral.rolloff;
    f.spectral_flatness = spectral.flatness;
    f.spectral_flux = spectral.flux;
    f.zero_crossing_rate = spectral.zero_crossing_rate;
    f.brightness = spectral.brightness;

    // ── Music Characteristics (algorithmic estimates) ──

    // Energy: based on RMS and loudness
    f.energy = std::clamp(f.rms * 3.0, 0.0, 1.0);

    // Danceability: tempo + beat strength proxy
    double tempo_factor = 0.0;
    if (f.bpm >= 100.0 && f.bpm <= 140.0) {
        tempo_factor = 1.0 - std::abs(f.bpm - 120.0) / 20.0;
    } else if (f.bpm >= 80.0 && f.bpm <= 160.0) {
        tempo_factor = 0.5;
    }
    f.danceability = std::clamp(tempo_factor * f.bpm_confidence, 0.0, 1.0);

    // Acousticness: inverse of spectral brightness + high-frequency energy
    f.acousticness = std::clamp(1.0 - f.brightness, 0.0, 1.0);

    // Instrumentalness: silence ratio + spectral characteristics
    f.instrumentalness = std::clamp(f.silence_ratio * 2.0, 0.0, 1.0);

    // ── Metadata ──
    f.engine_version = ENGINE_VERSION;
    f.analysis_schema_version = ANALYSIS_SCHEMA_VERSION;

    return f;
}

std::vector<std::string> Features::feature_names() {
    return {
        "duration_seconds",
        "sample_rate",
        "channels",
        "rms",
        "peak",
        "peak_abs",
        "crest_factor",
        "dynamic_range_db",
        "integrated_lufs",
        "true_peak_dbtp",
        "bpm",
        "bpm_confidence",
        "tempo_stability",
        "spectral_centroid",
        "spectral_bandwidth",
        "spectral_rolloff",
        "spectral_flatness",
        "spectral_flux",
        "zero_crossing_rate",
        "brightness",
        "silence_ratio",
        "leading_silence",
        "trailing_silence",
        "energy",
        "danceability",
        "acousticness",
        "instrumentalness",
    };
}

} // namespace fourang
