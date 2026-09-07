/**
 * 4ang Audio Engine — Loudness Tests
 */

#include "fourang/loudness.hpp"
#include "fourang/audio_buffer.hpp"
#include "test_main.cpp"
#include <cmath>

using namespace fourang;

TEST(loudness_empty) {
    AudioBuffer buf;
    auto result = Loudness::analyze(buf);
    ASSERT_NEAR(result.integrated_lufs, 0.0, 0.1);
}

TEST(loudness_sine_wave) {
    const size_t N = 44100;
    AudioBuffer buf(N, 1, 44100.0);

    // 0.5 amplitude sine wave
    for (size_t i = 0; i < N; ++i) {
        buf.set_sample(i, 0, 0.5f * std::sin(2.0f * 3.14159265f * 440.0f * i / N));
    }

    auto result = Loudness::analyze(buf);

    // RMS of 0.5 sine = 0.5/sqrt(2) ≈ 0.3536
    // LUFS ≈ -0.691 + 20*log10(0.3536) ≈ -0.691 + (-9.03) ≈ -9.72
    ASSERT_TRUE(result.integrated_lufs < 0.0);
    ASSERT_TRUE(result.integrated_lufs > -20.0);

    // True peak should be ~0 dBFS for 0.5 amplitude
    ASSERT_TRUE(result.true_peak_dbtp < 0.0);
    ASSERT_TRUE(result.true_peak_dbtp > -10.0);
}

TEST(loudness_silence_detection) {
    AudioBuffer buf(44100, 1, 44100.0);
    // First 1000 samples are silent
    // Next 1000 samples have signal
    for (size_t i = 1000; i < 2000; ++i) {
        buf.set_sample(i, 0, 0.5f);
    }

    auto regions = Loudness::detect_silence(buf, -60.0);

    // Should detect at least one silence region
    ASSERT_TRUE(regions.size() > 0);

    // Leading silence should be detected
    double leading = Loudness::leading_silence(buf);
    ASSERT_TRUE(leading > 0.0);
}
