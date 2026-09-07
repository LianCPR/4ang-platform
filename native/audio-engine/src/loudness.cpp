/**
 * 4ang Audio Engine — Loudness Implementation
 *
 * Simplified ITU-R BS.1770 loudness analysis.
 */

#include "fourang/loudness.hpp"
#include <cmath>
#include <algorithm>

namespace fourang {

double db_to_linear(double db) {
    return std::pow(10.0, db / 20.0);
}

double linear_to_db(double linear) {
    if (linear <= 0.0) return -100.0;
    return 20.0 * std::log10(linear);
}

LoudnessResult Loudness::analyze(const AudioBuffer& buffer) {
    LoudnessResult result{};

    if (buffer.empty()) {
        return result;
    }

    // Downmix to mono
    AudioBuffer mono = buffer.to_mono();
    const size_t num_frames = mono.num_frames();

    // ── Integrated Loudness (simplified) ──
    // Mean square of all samples
    double sum_sq = 0.0;
    for (size_t i = 0; i < num_frames; ++i) {
        float s = mono.channel(0)[i];
        sum_sq += static_cast<double>(s) * s;
    }
    double mean_square = sum_sq / static_cast<double>(num_frames);

    // LUFS (simplified — no K-weighting filter)
    if (mean_square > 0.0) {
        result.integrated_lufs = -0.691 + 10.0 * std::log10(mean_square);
    } else {
        result.integrated_lufs = -100.0;
    }

    // ── True Peak ──
    float peak = mono.peak_abs();
    result.true_peak_dbtp = linear_to_db(peak);

    // ── Short-term Loudness (3-second windows) ──
    const size_t window_size = static_cast<size_t>(mono.sample_rate() * 3.0);
    if (num_frames >= window_size) {
        double max_lufs = -100.0;
        for (size_t start = 0; start + window_size <= num_frames; start += window_size / 2) {
            double window_sum = 0.0;
            for (size_t i = 0; i < window_size; ++i) {
                float s = mono.channel(0)[start + i];
                window_sum += static_cast<double>(s) * s;
            }
            double window_rms = std::sqrt(window_sum / window_size);
            if (window_rms > 0.0) {
                double lufs = -0.691 + 10.0 * std::log10(window_rms);
                max_lufs = std::max(max_lufs, lufs);
            }
        }
        result.short_term_lufs = max_lufs;
    } else {
        result.short_term_lufs = result.integrated_lufs;
    }

    // ── Momentary Loudness (400ms windows) ──
    const size_t momentary_size = static_cast<size_t>(mono.sample_rate() * 0.4);
    if (num_frames >= momentary_size) {
        double max_lufs = -100.0;
        for (size_t start = 0; start + momentary_size <= num_frames; start += momentary_size / 2) {
            double window_sum = 0.0;
            for (size_t i = 0; i < momentary_size; ++i) {
                float s = mono.channel(0)[start + i];
                window_sum += static_cast<double>(s) * s;
            }
            double window_rms = std::sqrt(window_sum / momentary_size);
            if (window_rms > 0.0) {
                double lufs = -0.691 + 10.0 * std::log10(window_rms);
                max_lufs = std::max(max_lufs, lufs);
            }
        }
        result.momentary_lufs = max_lufs;
    } else {
        result.momentary_lufs = result.integrated_lufs;
    }

    // ── Dynamic Range ──
    result.dynamic_range_db = result.true_peak_dbtp - result.integrated_lufs;

    // ── Silence Ratio ──
    double silence_threshold = db_to_linear(-60.0);
    size_t silent_frames = 0;
    for (size_t i = 0; i < num_frames; ++i) {
        if (std::abs(mono.channel(0)[i]) < silence_threshold) {
            silent_frames++;
        }
    }
    result.silence_ratio = static_cast<double>(silent_frames) / static_cast<double>(num_frames);

    return result;
}

std::vector<Loudness::SilenceRegion> Loudness::detect_silence(
    const AudioBuffer& buffer,
    double threshold_db
) {
    std::vector<SilenceRegion> regions;

    if (buffer.empty()) return regions;

    AudioBuffer mono = buffer.to_mono();
    double threshold = db_to_linear(threshold_db);
    double sample_rate = mono.sample_rate();

    bool in_silence = false;
    size_t silence_start = 0;

    for (size_t i = 0; i < mono.num_frames(); ++i) {
        bool is_silent = std::abs(mono.channel(0)[i]) < threshold;

        if (is_silent && !in_silence) {
            silence_start = i;
            in_silence = true;
        } else if (!is_silent && in_silence) {
            size_t duration_frames = i - silence_start;
            if (duration_frames > static_cast<size_t>(sample_rate * 0.1)) { // >100ms
                regions.push_back({
                    static_cast<double>(silence_start) / sample_rate,
                    static_cast<double>(i) / sample_rate,
                    static_cast<double>(duration_frames) / sample_rate
                });
            }
            in_silence = false;
        }
    }

    // Handle trailing silence
    if (in_silence) {
        size_t duration_frames = mono.num_frames() - silence_start;
        if (duration_frames > static_cast<size_t>(sample_rate * 0.1)) {
            regions.push_back({
                static_cast<double>(silence_start) / sample_rate,
                mono.duration_seconds(),
                static_cast<double>(duration_frames) / sample_rate
            });
        }
    }

    return regions;
}

double Loudness::leading_silence(const AudioBuffer& buffer, double threshold_db) {
    auto regions = detect_silence(buffer, threshold_db);
    if (!regions.empty() && regions.front().start_seconds < 0.1) {
        return regions.front().duration_seconds;
    }
    return 0.0;
}

double Loudness::trailing_silence(const AudioBuffer& buffer, double threshold_db) {
    auto regions = detect_silence(buffer, threshold_db);
    if (!regions.empty() && regions.back().end_seconds >= buffer.duration_seconds() - 0.1) {
        return regions.back().duration_seconds;
    }
    return 0.0;
}

} // namespace fourang
