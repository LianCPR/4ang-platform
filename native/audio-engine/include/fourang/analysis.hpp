/**
 * 4ang Audio Engine — Analysis
 *
 * Main analysis orchestrator.
 * Coordinates all analysis modules into a unified result.
 */

#pragma once

#include "audio_buffer.hpp"
#include "waveform.hpp"
#include "loudness.hpp"
#include "spectrum.hpp"
#include "bpm.hpp"
#include "features.hpp"
#include <string>
#include <vector>

namespace fourang {

/**
 * Analysis options.
 */
struct AnalysisOptions {
    bool waveform = true;
    bool loudness = true;
    bool spectrum = true;
    bool tempo = true;
    bool features = true;
    bool silence = true;

    size_t waveform_points = 1000;
    size_t fft_size = 2048;
    double silence_threshold_db = -60.0;
};

/**
 * Complete analysis result.
 */
struct AnalysisResult {
    // ── Status ──
    bool success;
    std::string status;         // "completed" | "error"
    std::string error_message;
    std::string engine_version;
    int analysis_schema_version;

    // ── Audio Info ──
    double duration_seconds;
    double sample_rate;
    int channels;

    // ── Waveform ──
    WaveformData waveform;

    // ── Loudness ──
    LoudnessResult loudness;

    // ── Spectral ──
    SpectralFeatures spectral;

    // ── Tempo ──
    BPMResult tempo;
    BeatResult beats;

    // ── Silence ──
    std::vector<Loudness::SilenceRegion> silence_regions;

    // ── Features ──
    AudioFeatures features;

    /**
     * Serialize to JSON string.
     */
    std::string to_json() const;
};

/**
 * Main audio analyzer.
 * Coordinates all analysis modules.
 */
class AudioAnalyzer {
public:
    AudioAnalyzer() = default;

    /**
     * Analyze an audio buffer.
     * @param buffer Input audio
     * @param options Analysis options
     * @return Complete analysis result
     */
    AnalysisResult analyze(const AudioBuffer& buffer, const AnalysisOptions& options = {});

    /**
     * Analyze and return only features (lighter).
     */
    AudioFeatures extract_features(const AudioBuffer& buffer);

    /**
     * Get engine version.
     */
    static std::string version();
};

} // namespace fourang
