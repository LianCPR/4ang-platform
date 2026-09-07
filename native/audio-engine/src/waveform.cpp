/**
 * 4ang Audio Engine — Waveform Implementation
 */

#include "fourang/waveform.hpp"
#include <algorithm>
#include <cmath>

namespace fourang {

WaveformData Waveform::generate(const AudioBuffer& buffer, size_t num_points) {
    if (buffer.empty() || num_points == 0) {
        return {{}, 0, 0.0, buffer.sample_rate()};
    }

    // Downmix to mono for waveform
    AudioBuffer mono = buffer.to_mono();
    return generate_mono(mono, num_points);
}

WaveformData Waveform::generate_mono(const AudioBuffer& buffer, size_t num_points) {
    WaveformData result;
    result.num_points = num_points;
    result.duration_seconds = buffer.duration_seconds();
    result.sample_rate = buffer.sample_rate();
    result.points.resize(num_points);

    if (buffer.empty()) {
        return result;
    }

    const size_t frames_per_point = buffer.num_frames() / num_points;

    for (size_t i = 0; i < num_points; ++i) {
        const size_t start = i * frames_per_point;
        const size_t end = std::min(start + frames_per_point, buffer.num_frames());

        if (start >= buffer.num_frames()) {
            result.points[i] = {0.0f, 0.0f, 0.0f};
            continue;
        }

        float min_val = 1.0f;
        float max_val = -1.0f;
        double sum_sq = 0.0;
        size_t count = 0;

        // Use channel 0 (mono or first channel)
        auto ch = buffer.channel(0);
        for (size_t j = start; j < end; ++j) {
            float s = ch[j];
            min_val = std::min(min_val, s);
            max_val = std::max(max_val, s);
            sum_sq += static_cast<double>(s) * s;
            count++;
        }

        result.points[i] = {
            min_val,
            max_val,
            count > 0 ? static_cast<float>(std::sqrt(sum_sq / count)) : 0.0f
        };
    }

    return result;
}

} // namespace fourang
