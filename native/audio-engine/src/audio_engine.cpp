/**
 * 4ang Audio Engine — Core Implementation
 */

#include "audio_engine.h"
#include <cmath>
#include <algorithm>
#include <numeric>

namespace ang {

// ═══════════════════════════════════════════════════════════════════
// AudioBuffer
// ═══════════════════════════════════════════════════════════════════

AudioBuffer::AudioBuffer(size_t num_samples, int num_channels)
    : samples_(num_samples, 0.0f)
    , num_channels_(num_channels) {}

float* AudioBuffer::data() { return samples_.data(); }
const float* AudioBuffer::data() const { return samples_.data(); }
size_t AudioBuffer::num_samples() const { return samples_.size(); }
int AudioBuffer::num_channels() const { return num_channels_; }
double AudioBuffer::sample_rate() const { return sample_rate_; }
void AudioBuffer::set_sample_rate(double rate) { sample_rate_ = rate; }

float AudioBuffer::rms() const {
    if (samples_.empty()) return 0.0f;
    float sum = 0.0f;
    for (float s : samples_) sum += s * s;
    return std::sqrt(sum / static_cast<float>(samples_.size()));
}

float AudioBuffer::peak() const {
    if (samples_.empty()) return 0.0f;
    float max_val = 0.0f;
    for (float s : samples_) max_val = std::max(max_val, std::abs(s));
    return max_val;
}

// ═══════════════════════════════════════════════════════════════════
// AudioEngine
// ═══════════════════════════════════════════════════════════════════

AudioEngine::AudioEngine() = default;
AudioEngine::~AudioEngine() = default;

WaveformData AudioEngine::analyze_waveform(const AudioBuffer& buffer, size_t num_points) const {
    WaveformData result;
    result.num_points = num_points;
    result.duration_seconds = static_cast<double>(buffer.num_samples()) / buffer.sample_rate();
    result.min_amplitudes.resize(num_points, 0.0f);
    result.max_amplitudes.resize(num_points, 0.0f);

    if (buffer.num_samples() == 0) return result;

    const size_t samples_per_point = buffer.num_samples() / num_points;
    const float* data = buffer.data();

    for (size_t i = 0; i < num_points; ++i) {
        const size_t start = i * samples_per_point;
        const size_t end = std::min(start + samples_per_point, buffer.num_samples());

        float min_val = 1.0f;
        float max_val = -1.0f;

        for (size_t j = start; j < end; ++j) {
            min_val = std::min(min_val, data[j]);
            max_val = std::max(max_val, data[j]);
        }

        result.min_amplitudes[i] = min_val;
        result.max_amplitudes[i] = max_val;
    }

    return result;
}

LoudnessResult AudioEngine::analyze_loudness(const AudioBuffer& buffer) const {
    LoudnessResult result{};

    if (buffer.num_samples() == 0) return result;

    // Simplified integrated loudness (LUFS approximation)
    const float rms = buffer.rms();
    if (rms > 0.0f) {
        result.integrated_lufs = 20.0f * std::log10(rms) - 0.691f; // K-weighting approximation
    }

    // True peak
    const float peak = buffer.peak();
    if (peak > 0.0f) {
        result.true_peak_lufs = 20.0f * std::log10(peak);
    }

    // Dynamic range (simplified)
    result.dynamic_range_db = result.true_peak_lufs - result.integrated_lufs;
    result.short_term_lufs = result.integrated_lufs; // Simplified

    return result;
}

BeatResult AudioEngine::analyze_beats(const AudioBuffer& buffer) const {
    BeatResult result{};
    result.bpm = 0.0f;
    result.confidence = 0.0f;

    if (buffer.num_samples() < static_cast<size_t>(buffer.sample_rate())) {
        return result; // Need at least 1 second
    }

    // Simplified onset detection via energy threshold
    const size_t hop_size = static_cast<size_t>(buffer.sample_rate() * 0.01); // 10ms hop
    const size_t num_frames = buffer.num_samples() / hop_size;
    std::vector<float> energy(num_frames);

    for (size_t i = 0; i < num_frames; ++i) {
        float sum = 0.0f;
        const size_t start = i * hop_size;
        const size_t end = std::min(start + hop_size, buffer.num_samples());
        for (size_t j = start; j < end; ++j) {
            sum += buffer.data()[j] * buffer.data()[j];
        }
        energy[i] = sum / static_cast<float>(end - start);
    }

    // Simple peak picking for onsets
    float threshold = 0.0f;
    for (float e : energy) threshold += e;
    threshold /= static_cast<float>(num_frames);
    threshold *= 1.5f; // Adaptive threshold

    std::vector<double> onsets;
    for (size_t i = 1; i < num_frames - 1; ++i) {
        if (energy[i] > threshold && energy[i] > energy[i - 1] && energy[i] > energy[i + 1]) {
            onsets.push_back(static_cast<double>(i * hop_size) / buffer.sample_rate());
        }
    }

    result.beat_times = onsets;
    result.confidence = std::min(1.0f, static_cast<float>(onsets.size()) / 10.0f);

    // Estimate BPM from inter-onset intervals
    if (onsets.size() >= 2) {
        std::vector<double> intervals;
        for (size_t i = 1; i < onsets.size(); ++i) {
            intervals.push_back(onsets[i] - onsets[i - 1]);
        }
        double avg_interval = std::accumulate(intervals.begin(), intervals.end(), 0.0) / intervals.size();
        if (avg_interval > 0.0) {
            result.bpm = static_cast<float>(60.0 / avg_interval);
        }
    }

    return result;
}

std::vector<float> AudioEngine::extract_features(const AudioBuffer& buffer) const {
    std::vector<float> features;

    // RMS energy
    features.push_back(buffer.rms());

    // Peak level
    features.push_back(buffer.peak());

    // Loudness
    auto loudness = analyze_loudness(buffer);
    features.push_back(loudness.integrated_lufs);
    features.push_back(loudness.true_peak_lufs);
    features.push_back(loudness.dynamic_range_db);

    // Zero crossing rate (rough spectral feature)
    if (buffer.num_samples() > 1) {
        int crossings = 0;
        for (size_t i = 1; i < buffer.num_samples(); ++i) {
            if ((buffer.data()[i] >= 0) != (buffer.data()[i - 1] >= 0)) {
                crossings++;
            }
        }
        features.push_back(static_cast<float>(crossings) / buffer.num_samples());
    } else {
        features.push_back(0.0f);
    }

    // Spectral centroid approximation via zero crossings
    features.push_back(buffer.num_channels());
    features.push_back(static_cast<float>(buffer.sample_rate()));

    return features;
}

std::string AudioEngine::version() const {
    return "4ang-audio-engine/1.0.0";
}

} // namespace ang
