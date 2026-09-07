/**
 * 4ang Audio Engine — AudioBuffer Implementation
 */

#include "fourang/audio_buffer.hpp"
#include <algorithm>
#include <cmath>
#include <stdexcept>

namespace fourang {

AudioBuffer::AudioBuffer(size_t num_frames, int num_channels, double sample_rate)
    : samples_(num_frames * num_channels, 0.0f)
    , num_frames_(num_frames)
    , num_channels_(num_channels)
    , sample_rate_(sample_rate) {}

AudioBuffer::AudioBuffer(const float* data, size_t num_frames, int num_channels, double sample_rate)
    : samples_(data, data + num_frames * num_channels)
    , num_frames_(num_frames)
    , num_channels_(num_channels)
    , sample_rate_(sample_rate) {}

float AudioBuffer::sample(size_t frame, int channel) const {
    if (frame >= num_frames_ || channel < 0 || channel >= num_channels_) {
        return 0.0f; // Safe fallback
    }
    return samples_[index(frame, channel)];
}

void AudioBuffer::set_sample(size_t frame, int channel, float value) {
    if (frame >= num_frames_ || channel < 0 || channel >= num_channels_) {
        return; // Ignore out-of-bounds
    }
    samples_[index(frame, channel)] = value;
}

std::span<const float> AudioBuffer::channel(int ch) const {
    if (ch < 0 || ch >= num_channels_) {
        return {};
    }
    const float* start = samples_.data() + static_cast<size_t>(ch) * num_frames_;
    return std::span<const float>(start, num_frames_);
}

std::span<float> AudioBuffer::channel(int ch) {
    if (ch < 0 || ch >= num_channels_) {
        return {};
    }
    float* start = samples_.data() + static_cast<size_t>(ch) * num_frames_;
    return std::span<float>(start, num_frames_);
}

float AudioBuffer::rms() const {
    if (samples_.empty()) return 0.0f;

    double sum = 0.0;
    for (float s : samples_) {
        sum += static_cast<double>(s) * s;
    }
    return static_cast<float>(std::sqrt(sum / samples_.size()));
}

float AudioBuffer::peak() const {
    if (samples_.empty()) return 0.0f;

    float max_val = 0.0f;
    for (float s : samples_) {
        max_val = std::max(max_val, s);
    }
    return max_val;
}

float AudioBuffer::peak_abs() const {
    if (samples_.empty()) return 0.0f;

    float max_val = 0.0f;
    for (float s : samples_) {
        max_val = std::max(max_val, std::abs(s));
    }
    return max_val;
}

float AudioBuffer::crest_factor() const {
    float rms_val = rms();
    if (rms_val < 1e-10f) return 0.0f;
    return peak_abs() / rms_val;
}

AudioBuffer AudioBuffer::to_mono() const {
    if (num_channels_ == 1) {
        return *this;
    }

    AudioBuffer mono(num_frames_, 1, sample_rate_);
    for (size_t f = 0; f < num_frames_; ++f) {
        float sum = 0.0f;
        for (int ch = 0; ch < num_channels_; ++ch) {
            sum += sample(f, ch);
        }
        mono.set_sample(f, 0, sum / static_cast<float>(num_channels_));
    }
    return mono;
}

AudioBuffer AudioBuffer::segment(size_t start_frame, size_t num_frames) const {
    if (start_frame >= num_frames_) {
        return AudioBuffer(0, num_channels_, sample_rate_);
    }

    size_t actual_frames = std::min(num_frames, num_frames_ - start_frame);
    AudioBuffer seg(actual_frames, num_channels_, sample_rate_);

    for (int ch = 0; ch < num_channels_; ++ch) {
        auto src = channel(ch).subspan(start_frame, actual_frames);
        auto dst = seg.channel(ch);
        std::copy(src.begin(), src.end(), dst.begin());
    }

    return seg;
}

} // namespace fourang
