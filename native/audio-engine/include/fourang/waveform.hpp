/**
 * 4ang Audio Engine — Waveform
 *
 * Waveform generation for visualization.
 */

#pragma once

#include "audio_buffer.hpp"
#include <vector>

namespace fourang {

/**
 * Single waveform point.
 */
struct WaveformPoint {
    float min_amplitude;
    float max_amplitude;
    float rms;
};

/**
 * Complete waveform data.
 */
struct WaveformData {
    std::vector<WaveformPoint> points;
    size_t num_points;
    double duration_seconds;
    double sample_rate;
};

/**
 * Waveform generator.
 */
class Waveform {
public:
    /**
     * Generate waveform from audio buffer.
     * @param buffer Input audio
     * @param num_points Number of output points (e.g., 1000)
     * @return Waveform data suitable for visualization
     */
    static WaveformData generate(const AudioBuffer& buffer, size_t num_points = 1000);

    /**
     * Generate waveform from mono audio.
     */
    static WaveformData generate_mono(const AudioBuffer& buffer, size_t num_points = 1000);
};

} // namespace fourang
