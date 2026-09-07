/**
 * 4ang Audio Engine — Core Header
 *
 * High-performance audio analysis primitives.
 * Used for waveform generation, loudness analysis, and feature extraction.
 */

#pragma once

#include <vector>
#include <string>
#include <cstdint>
#include <memory>

namespace ang {

/**
 * Audio buffer holding PCM samples.
 * Supports mono and stereo.
 */
class AudioBuffer {
public:
    AudioBuffer() = default;
    AudioBuffer(size_t num_samples, int num_channels = 1);

    float* data();
    const float* data() const;
    size_t num_samples() const;
    int num_channels() const;
    double sample_rate() const;

    void set_sample_rate(double rate);
    float rms() const;
    float peak() const;

private:
    std::vector<float> samples_;
    int num_channels_ = 1;
    double sample_rate_ = 44100.0;
};

/**
 * Waveform data for visualization.
 */
struct WaveformData {
    std::vector<float> min_amplitudes;
    std::vector<float> max_amplitudes;
    size_t num_points;
    double duration_seconds;
};

/**
 * Loudness analysis result.
 */
struct LoudnessResult {
    float integrated_lufs;   // Integrated loudness (LUFS)
    float true_peak_lufs;    // True peak (LUFS)
    float short_term_lufs;   // Short-term loudness
    float dynamic_range_db;  // Dynamic range
};

/**
 * Beat/onset analysis result.
 */
struct BeatResult {
    std::vector<double> beat_times;    // Timestamps of beats
    float bpm;                         // Estimated BPM
    float confidence;                  // BPM confidence
};

/**
 * Main audio engine providing analysis capabilities.
 */
class AudioEngine {
public:
    AudioEngine();
    ~AudioEngine();

    /**
     * Generate waveform data from audio buffer.
     * @param buffer Input audio buffer
     * @param num_points Number of output points (e.g., 1000 for visualization)
     */
    WaveformData analyze_waveform(const AudioBuffer& buffer, size_t num_points = 1000) const;

    /**
     * Analyze loudness of audio buffer.
     * Implements ITU-R BS.1770 simplified.
     */
    LoudnessResult analyze_loudness(const AudioBuffer& buffer) const;

    /**
     * Detect beats/onsets in audio.
     */
    BeatResult analyze_beats(const AudioBuffer& buffer) const;

    /**
     * Extract basic audio features for recommendation.
     * Returns a feature vector for ML pipelines.
     */
    std::vector<float> extract_features(const AudioBuffer& buffer) const;

    /**
     * Get engine version info.
     */
    std::string version() const;
};

} // namespace ang
