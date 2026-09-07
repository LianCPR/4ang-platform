/**
 * 4ang Audio Engine — BPM Implementation
 *
 * Tempo estimation using onset detection + autocorrelation.
 */

#include "fourang/bpm.hpp"
#include "fourang/spectrum.hpp"
#include <cmath>
#include <algorithm>
#include <numeric>

namespace fourang {

constexpr double PI = 3.14159265358979323846;

std::vector<double> BPM::onset_strength(const AudioBuffer& buffer) {
    if (buffer.empty()) return {};

    AudioBuffer mono = buffer.to_mono();
    const size_t hop_size = 512;
    const size_t frame_size = 2048;
    const size_t num_frames = mono.num_frames();

    if (num_frames < frame_size) return {};

    // Number of analysis frames
    size_t num_analysis_frames = (num_frames - frame_size) / hop_size;
    std::vector<double> onset(num_analysis_frames);

    std::vector<double> prev_spectrum;
    auto ch = mono.channel(0);

    for (size_t frame = 0; frame < num_analysis_frames; ++frame) {
        size_t start = frame * hop_size;

        // Extract frame
        std::vector<double> signal(frame_size);
        for (size_t i = 0; i < frame_size; ++i) {
            signal[i] = (start + i < num_frames) ? ch[start + i] : 0.0;
        }

        // Compute spectrum
        auto spectrum = Spectrum::power_spectrum(signal, WindowType::Hann);

        // Spectral flux (half-wave rectified)
        double flux = 0.0;
        if (!prev_spectrum.empty()) {
            for (size_t i = 0; i < spectrum.size() && i < prev_spectrum.size(); ++i) {
                double diff = spectrum[i] - prev_spectrum[i];
                if (diff > 0) flux += diff;
            }
        }
        onset[frame] = flux;
        prev_spectrum = std::move(spectrum);
    }

    return onset;
}

double BPM::autocorrelation_tempo(
    const std::vector<double>& signal,
    double sample_rate,
    double& confidence
) {
    if (signal.size() < 2) {
        confidence = 0.0;
        return 0.0;
    }

    const size_t n = signal.size();

    // Compute autocorrelation
    std::vector<double> autocorr(n, 0.0);

    // Normalize signal
    double mean = std::accumulate(signal.begin(), signal.end(), 0.0) / n;
    double variance = 0.0;
    for (size_t i = 0; i < n; ++i) {
        variance += (signal[i] - mean) * (signal[i] - mean);
    }
    variance /= n;
    if (variance < 1e-10) {
        confidence = 0.0;
        return 0.0;
    }

    for (size_t lag = 0; lag < n; ++lag) {
        double sum = 0.0;
        for (size_t i = 0; i + lag < n; ++i) {
            sum += (signal[i] - mean) * (signal[i + lag] - mean);
        }
        autocorr[lag] = sum / (variance * n);
    }

    // Find peak in BPM range [60, 200]
    const double min_bpm = 60.0;
    const double max_bpm = 200.0;
    const size_t min_lag = static_cast<size_t>(sample_rate * 60.0 / max_bpm);
    const size_t max_lag = static_cast<size_t>(sample_rate * 60.0 / min_bpm);

    double best_corr = 0.0;
    size_t best_lag = 0;

    for (size_t lag = min_lag; lag <= std::min(max_lag, n - 1); ++lag) {
        if (autocorr[lag] > best_corr) {
            best_corr = autocorr[lag];
            best_lag = lag;
        }
    }

    if (best_lag == 0 || best_corr < 0.1) {
        confidence = 0.0;
        return 0.0;
    }

    double bpm = (sample_rate * 60.0) / static_cast<double>(best_lag);

    // Confidence based on autocorrelation peak strength
    confidence = std::min(1.0, best_corr * 2.0);

    return bpm;
}

BPMResult BPM::estimate(const AudioBuffer& buffer) {
    BPMResult result{};

    if (buffer.empty()) return result;

    // Get onset strength envelope
    auto onset = onset_strength(buffer);
    if (onset.empty()) return result;

    // Estimate tempo from onset envelope
    double sample_rate = static_cast<double>(onset.size()) / buffer.duration_seconds();
    double confidence = 0.0;
    double bpm = autocorrelation_tempo(onset, sample_rate, confidence);

    // Validate BPM range
    auto [min_bpm, max_bpm] = valid_bpm_range();
    if (bpm < min_bpm || bpm > max_bpm) {
        // Try octave correction
        while (bpm < min_bpm && bpm > 0) bpm *= 2.0;
        while (bpm > max_bpm && bpm > 0) bpm /= 2.0;
    }

    result.bpm = (bpm >= min_bpm && bpm <= max_bpm) ? bpm : 0.0;
    result.confidence = confidence;

    // Tempo stability (simplified — variance of onset intervals)
    result.tempo_stability = confidence; // Simplified

    return result;
}

BeatResult BPM::detect_beats(const AudioBuffer& buffer) {
    BeatResult result{};

    if (buffer.empty()) return result;

    // Get BPM first
    auto bpm_result = estimate(buffer);
    result.bpm = bpm_result.bpm;
    result.confidence = bpm_result.confidence;

    if (result.bpm < 1.0) return result;

    // Generate beat timestamps based on BPM
    double beat_interval = 60.0 / result.bpm;
    double duration = buffer.duration_seconds();

    std::vector<double> beats;
    std::vector<double> strengths;

    // Get onset strength for beat strength
    auto onset = onset_strength(buffer);
    double onset_sample_rate = static_cast<double>(onset.size()) / duration;

    for (double t = 0.0; t < duration; t += beat_interval) {
        beats.push_back(t);

        // Get onset strength at this time
        size_t onset_idx = static_cast<size_t>(t * onset_sample_rate);
        double strength = 0.0;
        if (onset_idx < onset.size()) {
            strength = onset[onset_idx];
        }
        strengths.push_back(strength);
    }

    result.beat_times = beats;
    result.beat_strengths = strengths;
    result.num_beats = beats.size();

    return result;
}

} // namespace fourang
