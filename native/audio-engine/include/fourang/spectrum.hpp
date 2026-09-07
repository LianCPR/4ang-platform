/**
 * 4ang Audio Engine — Spectrum
 *
 * FFT-based spectral analysis.
 */

#pragma once

#include "audio_buffer.hpp"
#include <vector>
#include <complex>

namespace fourang {

/**
 * Window function types.
 */
enum class WindowType {
    Hann,
    Hamming,
    Blackman,
    Rectangular
};

/**
 * FFT result for a single frame.
 */
struct FFTResult {
    std::vector<double> magnitudes;
    std::vector<double> phases;
    std::vector<double> frequencies;
    size_t num_bins;
    double frequency_resolution;
};

/**
 * Spectral features.
 */
struct SpectralFeatures {
    double centroid;        // Spectral centroid (Hz)
    double bandwidth;       // Spectral bandwidth (Hz)
    double rolloff;         // Spectral rolloff frequency (Hz)
    double flatness;        // Spectral flatness (0-1)
    double flux;            // Spectral flux
    double brightness;      // Brightness estimate (0-1)
};

/**
 * FFT analyzer.
 */
class Spectrum {
public:
    /**
     * Compute FFT of a signal.
     * @param signal Input samples
     * @param window Window function
     * @return FFT result
     */
    static FFTResult fft(
        const std::vector<double>& signal,
        WindowType window = WindowType::Hann
    );

    /**
     * Compute power spectrum.
     */
    static std::vector<double> power_spectrum(
        const std::vector<double>& signal,
        WindowType window = WindowType::Hann
    );

    /**
     * Extract spectral features from audio buffer.
     */
    static SpectralFeatures extract_features(
        const AudioBuffer& buffer,
        size_t fft_size = 2048,
        WindowType window = WindowType::Hann
    );

    /**
     * Compute zero crossing rate.
     */
    static double zero_crossing_rate(const AudioBuffer& buffer);

private:
    /**
     * Apply window function to signal.
     */
    static void apply_window(std::vector<double>& signal, WindowType window);

    /**
     * In-place FFT (Cooley-Tukey).
     */
    static void fft_impl(std::vector<std::complex<double>>& data);
};

} // namespace fourang
