/**
 * 4ang Audio Engine — Features Tests
 */

#include "fourang/features.hpp"
#include "fourang/audio_buffer.hpp"
#include "test_main.cpp"
#include <cmath>

using namespace fourang;

TEST(features_empty) {
    AudioBuffer buf;
    auto f = Features::extract(buf);
    ASSERT_NEAR(f.duration_seconds, 0.0, 0.001);
}

TEST(features_sine_wave) {
    const size_t N = 44100;
    AudioBuffer buf(N, 1, 44100.0);

    for (size_t i = 0; i < N; ++i) {
        buf.set_sample(i, 0, 0.5f * std::sin(2.0f * 3.14159265f * 440.0f * i / N));
    }

    auto f = Features::extract(buf);

    // Basic checks
    ASSERT_NEAR(f.duration_seconds, 1.0, 0.01);
    ASSERT_NEAR(f.sample_rate, 44100.0, 1.0);
    ASSERT_EQ(f.channels, 1);

    // RMS of 0.5 sine
    ASSERT_NEAR(f.rms, 0.5f / std::sqrt(2.0f), 0.02f);

    // Energy should be non-zero
    ASSERT_TRUE(f.energy > 0.0);
    ASSERT_TRUE(f.energy <= 1.0);

    // LUFS should be negative
    ASSERT_TRUE(f.integrated_lufs < 0.0);

    // Metadata
    ASSERT_TRUE(f.engine_version != nullptr);
    ASSERT_TRUE(strlen(f.engine_version) > 0);
}

TEST(features_feature_names) {
    auto names = Features::feature_names();
    ASSERT_TRUE(names.size() > 20);

    // Check some expected names
    bool found_rms = false;
    bool found_bpm = false;
    bool found_energy = false;
    for (auto& name : names) {
        if (name == "rms") found_rms = true;
        if (name == "bpm") found_bpm = true;
        if (name == "energy") found_energy = true;
    }
    ASSERT_TRUE(found_rms);
    ASSERT_TRUE(found_bpm);
    ASSERT_TRUE(found_energy);
}
