/**
 * 4ang Audio Engine — AudioBuffer Tests
 */

#include "fourang/audio_buffer.hpp"
#include "test_main.cpp"
#include <cmath>

using namespace fourang;

TEST(audio_buffer_empty) {
    AudioBuffer buf;
    ASSERT_TRUE(buf.empty());
    ASSERT_EQ(buf.num_frames(), 0u);
}

TEST(audio_buffer_create) {
    AudioBuffer buf(1000, 2, 44100.0);
    ASSERT_FALSE(buf.empty());
    ASSERT_EQ(buf.num_frames(), 1000u);
    ASSERT_EQ(buf.num_channels(), 2);
    ASSERT_NEAR(buf.sample_rate(), 44100.0, 1.0);
    ASSERT_NEAR(buf.duration_seconds(), 1000.0 / 44100.0, 0.001);
}

TEST(audio_buffer_sine_wave) {
    const size_t N = 44100;
    AudioBuffer buf(N, 1, 44100.0);

    // Fill with 440 Hz sine wave
    for (size_t i = 0; i < N; ++i) {
        float sample = 0.5f * std::sin(2.0f * 3.14159265f * 440.0f * i / 44100.0f);
        buf.set_sample(i, 0, sample);
    }

    // RMS of 0.5 amplitude sine is 0.5/sqrt(2) ≈ 0.3536
    float rms = buf.rms();
    ASSERT_NEAR(rms, 0.5f / std::sqrt(2.0f), 0.01f);

    // Peak should be ~0.5
    ASSERT_NEAR(buf.peak_abs(), 0.5f, 0.01f);
}

TEST(audio_buffer_mono_conversion) {
    AudioBuffer stereo(100, 2, 44100.0);

    // Left channel = 1.0, Right channel = 0.0
    for (size_t i = 0; i < 100; ++i) {
        stereo.set_sample(i, 0, 1.0f);
        stereo.set_sample(i, 1, 0.0f);
    }

    AudioBuffer mono = stereo.to_mono();
    ASSERT_EQ(mono.num_channels(), 1);
    ASSERT_EQ(mono.num_frames(), 100u);

    // Mono should be average: (1.0 + 0.0) / 2 = 0.5
    ASSERT_NEAR(mono.sample(0, 0), 0.5f, 0.001f);
}

TEST(audio_buffer_segment) {
    AudioBuffer buf(1000, 1, 44100.0);
    for (size_t i = 0; i < 1000; ++i) {
        buf.set_sample(i, 0, static_cast<float>(i) / 1000.0f);
    }

    AudioBuffer seg = buf.segment(100, 200);
    ASSERT_EQ(seg.num_frames(), 200u);
    ASSERT_NEAR(seg.sample(0, 0), 0.1f, 0.001f);
    ASSERT_NEAR(seg.sample(199, 0), 0.299f, 0.001f);
}

TEST(audio_buffer_crest_factor) {
    AudioBuffer buf(1000, 1, 44100.0);

    // Sine wave: crest factor = peak/rms = 1/sqrt(0.5) ≈ 1.414
    for (size_t i = 0; i < 1000; ++i) {
        buf.set_sample(i, 0, std::sin(2.0f * 3.14159265f * i / 100.0f));
    }

    float cf = buf.crest_factor();
    ASSERT_NEAR(cf, std::sqrt(2.0f), 0.1f);
}
