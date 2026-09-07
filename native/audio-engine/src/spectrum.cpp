/**
 * 4ang Audio Engine — Spectrum Implementation
 *
 * FFT-based spectral analysis.
 */

#include "fourang/spectrum.hpp"
#include <cmath>
#include <algorithm>
#include <numeric>

namespace fourang {

constexpr double PI = 3.14159265358979323846;

// ═══════════════════════════════════════════════════════════════════
// WINDOW FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

void Spectrum::apply_window(std::vector<double>& signal, WindowType window) {
    const size_t n = signal.size();
    for (size_t i = 0; i < n; ++i) {
        double t = static_cast<double>(i) / static_cast<double>(n - 1);
        double w = 1.0;

        switch (window) {
            case WindowType::Hann:
                w = 0.5 * (1.0 - std::cos(2.0 * PI * t));
                break;
            case WindowType::Hamming:
                w = 0.54 - 0.46 * std::cos(2.0 * PI * t);
                break;
            case WindowType::Blackman:
                w = 0.42 - 0.5 * std::cos(2.0 * PI * t) + 0.08 * std::cos(4.0 * PI * t);
                break;
            case WindowType::Rectangular:
                w = 1.0;
                break;
        }
        signal[i] *= w;
    }
}

// ═══════════════════════════════════════════════════════════════════
// FFT (Cooley-Tukey, radix-2)
// ═══════════════════════════════════════════════════════════════════

void Spectrum::fft_impl(std::vector<std::complex<double>>& data) {
    const size_t n = data.size();
    if (n <= 1) return;

    // Bit-reversal permutation
    for (size_t i = 1, j = 0; i < n; ++i) {
        size_t bit = n >> 1;
        for (; j & bit; bit >>= 1) {
            j ^= bit;
        }
        j ^= bit;
        if (i < j) {
            std::swap(data[i], data[j]);
        }
    }

    // Cooley-Tukey FFT
    for (size_t len = 2; len <= n; len <<= 1) {
        double angle = -2.0 * PI / static_cast<double>(len);
        std::complex<double> wlen(std::cos(angle), std::sin(angle));

        for (size_t i = 0; i < n; i += len) {
            std::complex<double> w(1.0);
            for (size_t j = 0; j < len / 2; ++j) {
                std::complex<double> u = data[i + j];
                std::complex<double> v = data[i + j + len / 2] * w;
                data[i + j] = u + v;
                data[i + j + len / 2] = u - v;
                w *= wlen;
            }
        }
    }
}

// ═══════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════

FFTResult Spectrum::fft(const std::vector<double>& signal, WindowType window) {
    FFTResult result;

    if (signal.empty()) {
        return result;
    }

    // Pad to next power of 2
    size_t n = 1;
    while (n < signal.size()) n <<= 1;

    std::vector<std::complex<double>> data(n, std::complex<double>(0.0, 0.0));
    for (size_t i = 0; i < signal.size(); ++i) {
        data[i] = signal[i];
    }

    // Apply window
    std::vector<double> windowed(signal.begin(), signal.end());
    windowed.resize(n, 0.0);
    apply_window(windowed, window);
    for (size_t i = 0; i < n; ++i) {
        data[i] = windowed[i];
    }

    // Compute FFT
    fft_impl(data);

    // Extract magnitudes and phases
    size_t num_bins = n / 2 + 1;
    result.magnitudes.resize(num_bins);
    result.phases.resize(num_bins);
    result.frequencies.resize(num_bins);
    result.num_bins = num_bins;
    result.frequency_resolution = 1.0 / static_cast<double>(n);

    for (size_t i = 0; i < num_bins; ++i) {
        result.magnitudes[i] = std::abs(data[i]) / static_cast<double>(n);
        result.phases[i] = std::arg(data[i]);
        result.frequencies[i] = static_cast<double>(i) * result.frequency_resolution;
    }

    return result;
}

std::vector<double> Spectrum::power_spectrum(const std::vector<double>& signal, WindowType window) {
    auto fft_result = fft(signal, window);
    std::vector<double> power(fft_result.magnitudes.size());
    for (size_t i = 0; i < power.size(); ++i) {
        power[i] = fft_result.magnitudes[i] * fft_result.magnitudes[i];
    }
    return power;
}

SpectralFeatures Spectrum::extract_features(const AudioBuffer& buffer, size_t fft_size, WindowType window) {
    SpectralFeatures features{};

    if (buffer.empty()) return features;

    // Take a segment for analysis
    AudioBuffer mono = buffer.to_mono();
    size_t segment_size = std::min(fft_size, mono.num_frames());
    auto seg = mono.segment(0, segment_size);

    // Convert to double
    std::vector<double> signal(segment_size);
    for (size_t i = 0; i < segment_size; ++i) {
        signal[i] = seg.channel(0)[i];
    }

    // Compute FFT
    auto fft_result = fft(signal, window);
    const auto& magnitudes = fft_result.magnitudes;
    const auto& frequencies = fft_result.frequencies;

    if (magnitudes.empty()) return features;

    // ── Spectral Centroid ──
    double sum_magnitude = 0.0;
    double sum_freq_magnitude = 0.0;
    for (size_t i = 0; i < magnitudes.size(); ++i) {
        sum_magnitude += magnitudes[i];
        sum_freq_magnitude += frequencies[i] * magnitudes[i];
    }
    features.centroid = sum_magnitude > 0 ? sum_freq_magnitude / sum_magnitude : 0.0;

    // ── Spectral Bandwidth ──
    double bandwidth_sum = 0.0;
    for (size_t i = 0; i < magnitudes.size(); ++i) {
        double diff = frequencies[i] - features.centroid;
        bandwidth_sum += diff * diff * magnitudes[i];
    }
    features.bandwidth = sum_magnitude > 0 ? std::sqrt(bandwidth_sum / sum_magnitude) : 0.0;

    // ── Spectral Rolloff (85%) ──
    double threshold = sum_magnitude * 0.85;
    double cumulative = 0.0;
    features.rolloff = frequencies.back();
    for (size_t i = 0; i < magnitudes.size(); ++i) {
        cumulative += magnitudes[i];
        if (cumulative >= threshold) {
            features.rolloff = frequencies[i];
            break;
        }
    }

    // ── Spectral Flatness ──
    double log_sum = 0.0;
    double linear_sum = 0.0;
    size_t non_zero = 0;
    for (size_t i = 0; i < magnitudes.size(); ++i) {
        if (magnitudes[i] > 1e-10) {
            log_sum += std::log(magnitudes[i]);
            linear_sum += magnitudes[i];
            non_zero++;
        }
    }
    if (non_zero > 0 && linear_sum > 0) {
        double geometric_mean = std::exp(log_sum / non_zero);
        double arithmetic_mean = linear_sum / non_zero;
        features.flatness = geometric_mean / arithmetic_mean;
    }

    // ── Zero Crossing Rate ──
    features.zero_crossing_rate = zero_crossing_rate(buffer);

    // ── Brightness (ratio of high-frequency energy) ──
    double total_energy = 0.0;
    double high_energy = 0.0;
    double nyquist = mono.sample_rate() / 2.0;
    for (size_t i = 0; i < magnitudes.size(); ++i) {
        total_energy += magnitudes[i] * magnitudes[i];
        if (frequencies[i] > nyquist * 0.5) {
            high_energy += magnitudes[i] * magnitudes[i];
        }
    }
    features.brightness = total_energy > 0 ? high_energy / total_energy : 0.0;

    // ── Spectral Flux (simplified — compare with previous frame) ──
    // For now, use energy variance as a proxy
    double mean_mag = sum_magnitude / magnitudes.size();
    double variance = 0.0;
    for (size_t i = 0; i < magnitudes.size(); ++i) {
        double diff = magnitudes[i] - mean_mag;
        variance += diff * diff;
    }
    features.flux = std::sqrt(variance / magnitudes.size());

    return features;
}

double Spectrum::zero_crossing_rate(const AudioBuffer& buffer) {
    if (buffer.empty() || buffer.num_frames() < 2) return 0.0;

    AudioBuffer mono = buffer.to_mono();
    auto ch = mono.channel(0);

    int crossings = 0;
    for (size_t i = 1; i < mono.num_frames(); ++i) {
        if ((ch[i] >= 0) != (ch[i - 1] >= 0)) {
            crossings++;
        }
    }

    return static_cast<double>(crossings) / static_cast<double>(mono.num_frames() - 1);
}

} // namespace fourang
