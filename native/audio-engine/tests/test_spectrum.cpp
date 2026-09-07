/**
 * 4ang Audio Engine — Spectrum Tests
 */

#include "fourang/spectrum.hpp"
#include "fourang/audio_buffer.hpp"
#include "test_main.cpp"
#include <cmath>

using namespace fourang;

TEST(spectrum_empty) {
    std::vector<double> signal;
    auto result = Spectrum::fft(signal);
    ASSERT_EQ(result.num_bins, 0u);
}

TEST(spectrum_sine_440) {
    // Generate 440 Hz sine wave at 44100 Hz sample rate
    const size_t N = 2048;
    const double sample_rate = 44100.0;
    std::vector<double> signal(N);

    for (size_t i = 0; i < N; ++i) {
        signal[i] = 0.5 * std::sin(2.0 * 3.14159265358979 * 440.0 * i / sample_rate);
    }

    auto result = Spectrum::fft(signal, WindowType::Hann);

    // Find the peak frequency
    double max_mag = 0.0;
    size_t max_idx = 0;
    for (size_t i = 1; i < result.magnitudes.size(); ++i) {
        if (result.magnitudes[i] > max_mag) {
            max_mag = result.magnitudes[i];
            max_idx = i;
        }
    }

    // Peak should be near 440 Hz
    double peak_freq = result.frequencies[max_idx];
    ASSERT_NEAR(peak_freq, 440.0, 20.0);
}

TEST(spectrum_zero_crossing_rate) {
    AudioBuffer buf(44100, 1, 44100.0);

    // 440 Hz sine wave
    for (size_t i = 0; i < 44100; ++i) {
        buf.set_sample(i, 0, std::sin(2.0f * 3.14159265f * 440.0f * i / 44100.0f));
    }

    double zcr = Spectrum::zero_crossing_rate(buf);

    // 440 Hz sine should have ZCR ≈ 880/44100 ≈ 0.01995
    ASSERT_NEAR(zcr, 880.0 / 44100.0, 0.005);
}

TEST(spectrum_power_spectrum) {
    std::vector<double> signal(1024);
    for (size_t i = 0; i < 1024; ++i) {
        signal[i] = std::sin(2.0 * 3.14159265358979 * 100.0 * i / 1024.0);
    }

    auto power = Spectrum::power_spectrum(signal);
    ASSERT_TRUE(power.size() > 0);

    // All power values should be non-negative
    for (double p : power) {
        ASSERT_TRUE(p >= 0.0);
    }
}
