/**
 * 4ang Audio Analyzer — CLI Tool
 *
 * Command-line audio analysis tool.
 * Generates synthetic test signals for validation.
 *
 * Usage:
 *   fourang-analyzer --sine 440 --duration 1.0 --json
 *   fourang-analyzer --pulse 120 --duration 5.0 --features
 *   fourang-analyzer --silence --duration 1.0
 */

#include "fourang/analysis.hpp"
#include "fourang/audio_buffer.hpp"
#include <iostream>
#include <string>
#include <cstring>
#include <cmath>
#include <cstdlib>

using namespace fourang;

void print_usage() {
    std::cout << "4ang Audio Analyzer v" << ENGINE_VERSION << "\n\n";
    std::cout << "Usage:\n";
    std::cout << "  fourang-analyzer [options]\n\n";
    std::cout << "Signal generation:\n";
    std::cout << "  --sine FREQ       Generate sine wave at FREQ Hz\n";
    std::cout << "  --pulse BPM       Generate pulse train at BPM\n";
    std::cout << "  --noise           Generate white noise\n";
    std::cout << "  --silence         Generate silence\n";
    std::cout << "  --duration SEC    Duration in seconds (default: 1.0)\n";
    std::cout << "  --sample-rate HZ  Sample rate (default: 44100)\n\n";
    std::cout << "Analysis options:\n";
    std::cout << "  --features        Extract features\n";
    std::cout << "  --loudness        Loudness analysis\n";
    std::cout << "  --tempo           BPM estimation\n";
    std::cout << "  --waveform        Waveform generation\n";
    std::cout << "  --spectrum        Spectral analysis\n";
    std::cout << "  --all             All analyses (default)\n\n";
    std::cout << "Output:\n";
    std::cout << "  --json            JSON output\n";
    std::cout << "  --verbose         Verbose output\n";
    std::cout << "  -h, --help        Show this help\n";
}

AudioBuffer generate_signal(const std::string& type, double freq, double duration, double sample_rate) {
    size_t num_samples = static_cast<size_t>(duration * sample_rate);
    AudioBuffer buf(num_samples, 1, sample_rate);

    if (type == "sine") {
        for (size_t i = 0; i < num_samples; ++i) {
            float sample = 0.5f * std::sin(2.0f * 3.14159265f * static_cast<float>(freq) * i / static_cast<float>(sample_rate));
            buf.set_sample(i, 0, sample);
        }
    } else if (type == "pulse") {
        double beat_interval = 60.0 / freq; // freq is BPM
        for (size_t i = 0; i < num_samples; ++i) {
            double t = static_cast<double>(i) / sample_rate;
            double beat_phase = std::fmod(t, beat_interval);
            if (beat_phase < 0.01) {
                buf.set_sample(i, 0, 0.8f);
            } else {
                buf.set_sample(i, 0, 0.02f);
            }
        }
    } else if (type == "noise") {
        for (size_t i = 0; i < num_samples; ++i) {
            buf.set_sample(i, 0, static_cast<float>(std::rand()) / RAND_MAX * 0.5f - 0.25f);
        }
    }
    // silence is default (all zeros)

    return buf;
}

int main(int argc, char* argv[]) {
    std::string signal_type = "sine";
    double frequency = 440.0;
    double duration = 1.0;
    double sample_rate = 44100.0;
    bool json_output = false;
    bool verbose = false;
    bool show_features = true;
    bool show_loudness = true;
    bool show_tempo = true;
    bool show_waveform = false;
    bool show_spectrum = false;

    for (int i = 1; i < argc; ++i) {
        std::string arg = argv[i];

        if (arg == "-h" || arg == "--help") {
            print_usage();
            return 0;
        } else if (arg == "--sine" && i + 1 < argc) {
            signal_type = "sine";
            frequency = std::atof(argv[++i]);
        } else if (arg == "--pulse" && i + 1 < argc) {
            signal_type = "pulse";
            frequency = std::atof(argv[++i]);
        } else if (arg == "--noise") {
            signal_type = "noise";
        } else if (arg == "--silence") {
            signal_type = "silence";
        } else if (arg == "--duration" && i + 1 < argc) {
            duration = std::atof(argv[++i]);
        } else if (arg == "--sample-rate" && i + 1 < argc) {
            sample_rate = std::atof(argv[++i]);
        } else if (arg == "--json") {
            json_output = true;
        } else if (arg == "--verbose") {
            verbose = true;
        } else if (arg == "--features") {
            show_features = true;
        } else if (arg == "--loudness") {
            show_loudness = true;
        } else if (arg == "--tempo") {
            show_tempo = true;
        } else if (arg == "--waveform") {
            show_waveform = true;
        } else if (arg == "--spectrum") {
            show_spectrum = true;
        } else if (arg == "--all") {
            show_features = true;
            show_loudness = true;
            show_tempo = true;
            show_waveform = true;
            show_spectrum = true;
        }
    }

    // Generate signal
    auto buffer = generate_signal(signal_type, frequency, duration, sample_rate);

    if (verbose) {
        std::cerr << "Generated " << signal_type << " signal: "
                  << duration << "s, " << sample_rate << " Hz, "
                  << buffer.num_frames() << " frames\n";
    }

    // Analyze
    AnalysisOptions options;
    options.waveform = show_waveform;
    options.loudness = show_loudness;
    options.spectrum = show_spectrum;
    options.tempo = show_tempo;
    options.features = show_features;

    AudioAnalyzer analyzer;
    auto result = analyzer.analyze(buffer, options);

    // Output
    if (json_output) {
        std::cout << result.to_json() << "\n";
    } else {
        std::cout << "=== 4ang Audio Analysis ===\n";
        std::cout << "Engine: " << result.engine_version << "\n";
        std::cout << "Status: " << result.status << "\n";
        std::cout << "Duration: " << result.duration_seconds << "s\n";
        std::cout << "Sample Rate: " << result.sample_rate << " Hz\n";
        std::cout << "Channels: " << result.channels << "\n";

        if (show_loudness) {
            std::cout << "\n--- Loudness ---\n";
            std::cout << "Integrated: " << result.loudness.integrated_lufs << " LUFS\n";
            std::cout << "True Peak: " << result.loudness.true_peak_dbtp << " dBTP\n";
            std::cout << "Dynamic Range: " << result.loudness.dynamic_range_db << " dB\n";
        }

        if (show_tempo) {
            std::cout << "\n--- Tempo ---\n";
            std::cout << "BPM: " << result.tempo.bpm << " (confidence: " << result.tempo.confidence << ")\n";
        }

        if (show_features) {
            std::cout << "\n--- Features ---\n";
            std::cout << "RMS: " << result.features.rms << "\n";
            std::cout << "Peak: " << result.features.peak << "\n";
            std::cout << "Energy: " << result.features.energy << "\n";
            std::cout << "Spectral Centroid: " << result.features.spectral_centroid << " Hz\n";
            std::cout << "Spectral Brightness: " << result.features.brightness << "\n";
        }

        if (show_waveform) {
            std::cout << "\n--- Waveform ---\n";
            std::cout << "Points: " << result.waveform.num_points << "\n";
        }
    }

    return result.success ? 0 : 1;
}
