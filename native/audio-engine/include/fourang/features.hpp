/**
 * 4ang Audio Engine — Features
 *
 * Unified audio feature extraction.
 */

#pragma once

#include "audio_buffer.hpp"

namespace fourang {

/**
 * Complete audio feature vector.
 * All fields use stable names for cross-language compatibility.
 */
struct AudioFeatures {
    // ── Basic Info ──
    double duration_seconds;
    double sample_rate;
    int channels;

    // ── Amplitude ──
    double rms;
    double peak;
    double peak_abs;
    double crest_factor;
    double dynamic_range_db;

    // ── Loudness ──
    double integrated_lufs;
    double true_peak_dbtp;

    // ── Tempo ──
    double bpm;
    double bpm_confidence;
    double tempo_stability;

    // ── Spectral ──
    double spectral_centroid;
    double spectral_bandwidth;
    double spectral_rolloff;
    double spectral_flatness;
    double spectral_flux;
    double zero_crossing_rate;
    double brightness;

    // ── Silence ──
    double silence_ratio;
    double leading_silence;
    double trailing_silence;

    // ── Music Characteristics (algorithmic estimates) ──
    double energy;          // Overall energy (0-1)
    double danceability;    // Tempo + beat strength proxy (0-1)
    double acousticness;    // Spectral flatness proxy (0-1)
    double instrumentalness;// Silence ratio + spectral proxy (0-1)

    // ── Metadata ──
    const char* engine_version;
    int analysis_schema_version;
};

/**
 * Feature extractor.
 */
class Features {
public:
    /**
     * Extract complete audio features.
     */
    static AudioFeatures extract(const AudioBuffer& buffer);

    /**
     * Get feature names (for serialization).
     */
    static std::vector<std::string> feature_names();
};

} // namespace fourang
