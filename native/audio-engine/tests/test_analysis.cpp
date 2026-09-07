/**
 * 4ang Audio Engine — Analysis Tests
 */

#include "fourang/analysis.hpp"
#include "fourang/audio_buffer.hpp"
#include "test_main.cpp"
#include <cmath>

using namespace fourang;

TEST(analyze_empty) {
    AudioBuffer buf;
    AudioAnalyzer analyzer;
    auto result = analyzer.analyze(buf);
    ASSERT_FALSE(result.success);
    ASSERT_EQ(result.status, "error");
}

TEST(analyze_sine_wave) {
    const size_t N = 44100;
    AudioBuffer buf(N, 1, 44100.0);

    for (size_t i = 0; i < N; ++i) {
        buf.set_sample(i, 0, 0.5f * std::sin(2.0f * 3.14159265f * 440.0f * i / N));
    }

    AudioAnalyzer analyzer;
    auto result = analyzer.analyze(buf);

    ASSERT_TRUE(result.success);
    ASSERT_EQ(result.status, "completed");
    ASSERT_NEAR(result.duration_seconds, 1.0, 0.01);
    ASSERT_EQ(result.channels, 1);

    // Waveform should have points
    ASSERT_TRUE(result.waveform.num_points > 0);

    // Loudness should be computed
    ASSERT_TRUE(result.loudness.integrated_lufs < 0.0);

    // Features should be computed
    ASSERT_TRUE(result.features.rms > 0.0);
}

TEST(analyze_to_json) {
    const size_t N = 44100;
    AudioBuffer buf(N, 1, 44100.0);

    for (size_t i = 0; i < N; ++i) {
        buf.set_sample(i, 0, 0.5f * std::sin(2.0f * 3.14159265f * 440.0f * i / N));
    }

    AudioAnalyzer analyzer;
    auto result = analyzer.analyze(buf);
    std::string json = result.to_json();

    // JSON should contain key fields
    ASSERT_TRUE(json.find("\"status\"") != std::string::npos);
    ASSERT_TRUE(json.find("\"engineVersion\"") != std::string::npos);
    ASSERT_TRUE(json.find("\"duration\"") != std::string::npos);
    ASSERT_TRUE(json.find("\"loudness\"") != std::string::npos);
    ASSERT_TRUE(json.find("\"tempo\"") != std::string::npos);
    ASSERT_TRUE(json.find("\"features\"") != std::string::npos);
}

TEST(analyze_version) {
    std::string version = AudioAnalyzer::version();
    ASSERT_TRUE(version.size() > 0);
    ASSERT_TRUE(version.find("4.3") != std::string::npos);
}

TEST(analyze_extract_features) {
    const size_t N = 44100;
    AudioBuffer buf(N, 1, 44100.0);

    for (size_t i = 0; i < N; ++i) {
        buf.set_sample(i, 0, 0.3f * std::sin(2.0f * 3.14159265f * 440.0f * i / N));
    }

    AudioAnalyzer analyzer;
    auto features = analyzer.extract_features(buf);

    ASSERT_TRUE(features.rms > 0.0);
    ASSERT_TRUE(features.duration_seconds > 0.0);
}
