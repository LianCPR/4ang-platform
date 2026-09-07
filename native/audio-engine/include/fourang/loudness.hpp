/**
 * 4ang Audio Engine — Loudness
 *
 * ITU-R BS.1770 loudness analysis.
 */

#pragma once

#include "audio_buffer.hpp"

namespace fourang {

/**
 * Loudness analysis result.
 */
struct LoudnessResult {
    double integrated_lufs;    // Integrated loudness (LUFS)
    double true_peak_dbtp;     // True peak (dBTP)
    double short_term_lufs;    // Short-term loudness
    double momentary_lufs;     // Momentary loudness
    double dynamic_range_db;   // Dynamic range
    double silence_ratio;      // Ratio of silence frames
};

/**
 * Loudness analyzer implementing ITU-R BS.1770 simplified.
 */
class Loudness {
public:
    /**
     * Analyze loudness of audio buffer.
     * Implements simplified ITU-R BS.1770.
     */
    static LoudnessResult analyze(const AudioBuffer& buffer);

    /**
     * Detect silence regions.
     * @param threshold_db Threshold in dB (default: -60 dB)
     * @return Vector of silence regions [start_time, end_time]
     */
    struct SilenceRegion {
        double start_seconds;
        double end_seconds;
        double duration_seconds;
    };

    static std::vector<SilenceRegion> detect_silence(
        const AudioBuffer& buffer,
        double threshold_db = -60.0
    );

    /**
     * Get leading silence duration.
     */
    static double leading_silence(const AudioBuffer& buffer, double threshold_db = -60.0);

    /**
     * Get trailing silence duration.
     */
    static double trailing_silence(const AudioBuffer& buffer, double threshold_db = -60.0);
};

} // namespace fourang
