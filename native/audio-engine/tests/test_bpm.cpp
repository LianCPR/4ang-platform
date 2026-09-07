/**
 * 4ang Audio Engine — BPM Tests
 */

#include "fourang/bpm.hpp"
#include "fourang/audio_buffer.hpp"
#include "test_main.cpp"
#include <cmath>

using namespace fourang;

TEST(bpm_empty) {
    AudioBuffer buf;
    auto result = BPM::estimate(buf);
    ASSERT_NEAR(result.bpm, 0.0, 0.1);
}

TEST(bpm_pulse_120) {
    // Generate a pulse train at 120 BPM (2 beats per second)
    const double sample_rate = 44100.0;
    const double bpm = 120.0;
    const double beat_interval = 60.0 / bpm; // 0.5 seconds
    const size_t duration_samples = static_cast<size_t>(sample_rate * 5.0); // 5 seconds

    AudioBuffer buf(duration_samples, 1, sample_rate);

    // Create impulse train
    for (size_t i = 0; i < duration_samples; ++i) {
        double t = static_cast<double>(i) / sample_rate;
        // Short impulse at each beat
        double beat_phase = std::fmod(t, beat_interval);
        if (beat_phase < 0.01) { // 10ms impulse
            buf.set_sample(i, 0, 0.8f);
        } else {
            buf.set_sample(i, 0, 0.05f * std::sin(2.0 * 3.14159265 * 440.0 * t));
        }
    }

    auto result = BPM::estimate(buf);

    // BPM should be near 120
    ASSERT_NEAR(result.bpm, 120.0, 15.0);
    ASSERT_TRUE(result.confidence > 0.3);
}

TEST(bpm_valid_range) {
    auto [min, max] = BPM::valid_bpm_range();
    ASSERT_TRUE(min > 0);
    ASSERT_TRUE(max > min);
    ASSERT_TRUE(max <= 250.0);
}
