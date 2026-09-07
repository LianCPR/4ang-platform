/**
 * 4ang Audio Engine — AudioBuffer
 *
 * Core audio data container.
 * Supports mono, stereo, and multichannel audio.
 */

#pragma once

#include <vector>
#include <cstddef>
#include <cstdint>
#include <span>
#include <optional>
#include <cmath>

namespace fourang {

/**
 * Audio buffer holding PCM samples in floating-point format.
 * Samples are normalized to [-1.0, 1.0] range.
 */
class AudioBuffer {
public:
    AudioBuffer() = default;

    /**
     * Create an empty buffer with specified dimensions.
     */
    AudioBuffer(size_t num_frames, int num_channels, double sample_rate = 44100.0);

    /**
     * Create from raw float data (copy).
     */
    AudioBuffer(const float* data, size_t num_frames, int num_channels, double sample_rate = 44100.0);

    // ── Accessors ──
    size_t num_frames() const noexcept { return num_frames_; }
    int num_channels() const noexcept { return num_channels_; }
    double sample_rate() const noexcept { return sample_rate_; }

    double duration_seconds() const noexcept {
        return num_frames_ > 0 ? static_cast<double>(num_frames_) / sample_rate_ : 0.0;
    }

    bool empty() const noexcept { return num_frames_ == 0; }

    // ── Sample Access ──
    float sample(size_t frame, int channel) const;
    void set_sample(size_t frame, int channel, float value);

    // ── Channel Access ──
    std::span<const float> channel(int ch) const;
    std::span<float> channel(int ch);

    // ── All Data ──
    const float* data() const noexcept { return samples_.data(); }
    float* data() noexcept { return samples_.data(); }
    size_t total_samples() const noexcept { return samples_.size(); }

    // ── Analysis Helpers ──
    float rms() const;
    float peak() const;
    float peak_abs() const;
    float crest_factor() const;

    /**
     * Get a downmixed mono version of the buffer.
     */
    AudioBuffer to_mono() const;

    /**
     * Get a segment of the buffer.
     */
    AudioBuffer segment(size_t start_frame, size_t num_frames) const;

private:
    std::vector<float> samples_;
    size_t num_frames_ = 0;
    int num_channels_ = 1;
    double sample_rate_ = 44100.0;

    size_t index(size_t frame, int channel) const noexcept {
        return static_cast<size_t>(channel) * num_frames_ + frame;
    }
};

} // namespace fourang
