/**
 * 4ang Audio Engine — BPM
 *
 * Tempo estimation and beat detection.
 */

#pragma once

#include "audio_buffer.hpp"
#include <vector>

namespace fourang {

/**
 * BPM estimation result.
 */
struct BPMResult {
    double bpm;              // Estimated BPM
    double confidence;       // Confidence (0-1)
    double tempo_stability;  // Tempo stability (0-1)
    std::vector<double> candidates;  // Alternative BPM candidates
};

/**
 * Beat detection result.
 */
struct BeatResult {
    std::vector<double> beat_times;    // Beat timestamps (seconds)
    std::vector<double> beat_strengths; // Beat strengths
    double bpm;
    double confidence;
    size_t num_beats;
};

/**
 * BPM estimator.
 */
class BPM {
public:
    /**
     * Estimate BPM from audio buffer.
     * Uses onset detection + autocorrelation.
     */
    static BPMResult estimate(const AudioBuffer& buffer);

    /**
     * Detect beats/onsets.
     * Returns timestamps of detected beats.
     */
    static BeatResult detect_beats(const AudioBuffer& buffer);

    /**
     * Estimate BPM range.
     * @return [min_bpm, max_bpm]
     */
    static std::pair<double, double> valid_bpm_range() {
        return {60.0, 200.0};
    }

private:
    /**
     * Compute onset strength envelope.
     */
    static std::vector<double> onset_strength(const AudioBuffer& buffer);

    /**
     * Autocorrelation-based tempo estimation.
     */
    static double autocorrelation_tempo(
        const std::vector<double>& signal,
        double sample_rate,
        double& confidence
    );
};

} // namespace fourang
