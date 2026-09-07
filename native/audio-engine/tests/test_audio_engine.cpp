/**
 * 4ang Audio Engine — Unit Tests
 */

#include "audio_engine.h"
#include <cassert>
#include <iostream>
#include <cmath>

using namespace ang;

void test_audio_buffer() {
    AudioBuffer buf(1000, 1);
    assert(buf.num_samples() == 1000);
    assert(buf.num_channels() == 1);
    assert(buf.rms() == 0.0f);
    assert(buf.peak() == 0.0f);
    std::cout << "PASS: AudioBuffer basic\n";
}

void test_waveform() {
    AudioEngine engine;
    AudioBuffer buf(44100, 1); // 1 second at 44.1kHz

    // Fill with sine wave
    for (size_t i = 0; i < 44100; ++i) {
        buf.data()[i] = std::sin(2.0f * M_PI * 440.0f * i / 44100.0f);
    }

    auto waveform = engine.analyze_waveform(buf, 100);
    assert(waveform.num_points == 100);
    assert(waveform.min_amplitudes.size() == 100);
    assert(waveform.max_amplitudes.size() == 100);

    // Sine wave should have symmetric min/max roughly
    for (size_t i = 0; i < 100; ++i) {
        assert(waveform.max_amplitudes[i] > 0.0f);
        assert(waveform.min_amplitudes[i] < 0.0f);
    }

    std::cout << "PASS: Waveform analysis\n";
}

void test_loudness() {
    AudioEngine engine;
    AudioBuffer buf(44100, 1);

    // Fill with sine wave (known loudness)
    for (size_t i = 0; i < 44100; ++i) {
        buf.data()[i] = 0.5f * std::sin(2.0f * M_PI * 440.0f * i / 44100.0f);
    }

    auto loudness = engine.analyze_loudness(buf);
    assert(loudness.integrated_lufs < 0.0f); // Should be negative for normal audio
    assert(loudness.true_peak_lufs < 0.0f);

    std::cout << "PASS: Loudness analysis\n";
}

void test_features() {
    AudioEngine engine;
    AudioBuffer buf(44100, 1);

    for (size_t i = 0; i < 44100; ++i) {
        buf.data()[i] = std::sin(2.0f * M_PI * 440.0f * i / 44100.0f);
    }

    auto features = engine.extract_features(buf);
    assert(features.size() >= 7); // At least 7 features

    std::cout << "PASS: Feature extraction\n";
}

void test_version() {
    AudioEngine engine;
    assert(!engine.version().empty());
    std::cout << "PASS: Version check\n";
}

int main() {
    std::cout << "=== 4ang Audio Engine Tests ===\n";
    test_audio_buffer();
    test_waveform();
    test_loudness();
    test_features();
    test_version();
    std::cout << "=== All tests passed ===\n";
    return 0;
}
