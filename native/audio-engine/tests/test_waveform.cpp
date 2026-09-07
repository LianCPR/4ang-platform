/**
 * 4ang Audio Engine — Waveform Tests
 */

#include "fourang/waveform.hpp"
#include "fourang/audio_buffer.hpp"
#include "test_main.cpp"
#include <cmath>

using namespace fourang;

TEST(waveform_empty) {
    AudioBuffer buf;
    auto wf = Waveform::generate(buf, 100);
    ASSERT_EQ(wf.num_points, 0u);
}

TEST(waveform_basic) {
    AudioBuffer buf(44100, 1, 44100.0);
    for (size_t i = 0; i < 44100; ++i) {
        buf.set_sample(i, 0, 0.5f * std::sin(2.0f * 3.14159265f * 440.0f * i / 44100.0f));
    }

    auto wf = Waveform::generate(buf, 100);
    ASSERT_EQ(wf.num_points, 100u);
    ASSERT_EQ(wf.points.size(), 100u);

    // Each point should have valid values
    for (auto& pt : wf.points) {
        ASSERT_TRUE(pt.max_amplitude >= pt.min_amplitude);
        ASSERT_TRUE(pt.rms >= 0.0f);
    }
}

TEST(waveform_silence) {
    AudioBuffer buf(44100, 1, 44100.0);
    // All zeros

    auto wf = Waveform::generate(buf, 10);
    for (auto& pt : wf.points) {
        ASSERT_NEAR(pt.min_amplitude, 0.0f, 0.001f);
        ASSERT_NEAR(pt.max_amplitude, 0.0f, 0.001f);
        ASSERT_NEAR(pt.rms, 0.0f, 0.001f);
    }
}
