/**
 * 4ang Audio Engine — Analysis Implementation
 *
 * Main orchestrator coordinating all analysis modules.
 */

#include "fourang/analysis.hpp"
#include "fourang/version.hpp"
#include <sstream>

namespace fourang {

std::string AnalysisResult::to_json() const {
    std::ostringstream json;
    json << "{\n";
    json << "  \"status\": \"" << status << "\",\n";
    json << "  \"engineVersion\": \"" << engine_version << "\",\n";
    json << "  \"analysisSchemaVersion\": " << analysis_schema_version << ",\n";

    if (!success) {
        json << "  \"error\": \"" << error_message << "\"\n";
        json << "}";
        return json.str();
    }

    json << "  \"duration\": " << duration_seconds << ",\n";
    json << "  \"sampleRate\": " << sample_rate << ",\n";
    json << "  \"channels\": " << channels << ",\n";

    // Loudness
    json << "  \"loudness\": {\n";
    json << "    \"integratedLufs\": " << loudness.integrated_lufs << ",\n";
    json << "    \"truePeakDbtp\": " << loudness.true_peak_dbtp << ",\n";
    json << "    \"shortTermLufs\": " << loudness.short_term_lufs << ",\n";
    json << "    \"dynamicRangeDb\": " << loudness.dynamic_range_db << ",\n";
    json << "    \"silenceRatio\": " << loudness.silence_ratio << "\n";
    json << "  },\n";

    // Tempo
    json << "  \"tempo\": {\n";
    json << "    \"bpm\": " << tempo.bpm << ",\n";
    json << "    \"confidence\": " << tempo.confidence << ",\n";
    json << "    \"tempoStability\": " << tempo.tempo_stability << "\n";
    json << "  },\n";

    // Spectral
    json << "  \"spectral\": {\n";
    json << "    \"centroid\": " << spectral.centroid << ",\n";
    json << "    \"bandwidth\": " << spectral.bandwidth << ",\n";
    json << "    \"rolloff\": " << spectral.rolloff << ",\n";
    json << "    \"flatness\": " << spectral.flatness << ",\n";
    json << "    \"flux\": " << spectral.flux << ",\n";
    json << "    \"brightness\": " << spectral.brightness << "\n";
    json << "  },\n";

    // Features
    json << "  \"features\": {\n";
    json << "    \"rms\": " << features.rms << ",\n";
    json << "    \"peak\": " << features.peak << ",\n";
    json << "    \"dynamicRangeDb\": " << features.dynamic_range_db << ",\n";
    json << "    \"energy\": " << features.energy << ",\n";
    json << "    \"danceability\": " << features.danceability << ",\n";
    json << "    \"acousticness\": " << features.acousticness << ",\n";
    json << "    \"instrumentalness\": " << features.instrumentalness << ",\n";
    json << "    \"zeroCrossingRate\": " << features.zero_crossing_rate << "\n";
    json << "  },\n";

    // Waveform summary
    json << "  \"waveform\": {\n";
    json << "    \"numPoints\": " << waveform.num_points << "\n";
    json << "  },\n";

    // Beats
    json << "  \"beats\": {\n";
    json << "    \"numBeats\": " << beats.num_beats << "\n";
    json << "  },\n";

    // Silence regions
    json << "  \"silenceRegions\": " << silence_regions.size() << "\n";

    json << "}";
    return json.str();
}

AnalysisResult AudioAnalyzer::analyze(const AudioBuffer& buffer, const AnalysisOptions& options) {
    AnalysisResult result{};
    result.engine_version = ENGINE_VERSION;
    result.analysis_schema_version = ANALYSIS_SCHEMA_VERSION;

    if (buffer.empty()) {
        result.success = false;
        result.status = "error";
        result.error_message = "Empty audio buffer";
        return result;
    }

    try {
        result.duration_seconds = buffer.duration_seconds();
        result.sample_rate = buffer.sample_rate();
        result.channels = buffer.num_channels();

        // Waveform
        if (options.waveform) {
            result.waveform = Waveform::generate(buffer, options.waveform_points);
        }

        // Loudness
        if (options.loudness) {
            result.loudness = Loudness::analyze(buffer);
        }

        // Silence
        if (options.silence) {
            result.silence_regions = Loudness::detect_silence(buffer, options.silence_threshold_db);
        }

        // Spectrum
        if (options.spectrum) {
            result.spectral = Spectrum::extract_features(buffer, options.fft_size);
        }

        // Tempo
        if (options.tempo) {
            result.tempo = BPM::estimate(buffer);
            result.beats = BPM::detect_beats(buffer);
        }

        // Features
        if (options.features) {
            result.features = Features::extract(buffer);
        }

        result.success = true;
        result.status = "completed";

    } catch (const std::exception& e) {
        result.success = false;
        result.status = "error";
        result.error_message = e.what();
    }

    return result;
}

AudioFeatures AudioAnalyzer::extract_features(const AudioBuffer& buffer) {
    return Features::extract(buffer);
}

std::string AudioAnalyzer::version() {
    return std::string(ENGINE_VERSION);
}

} // namespace fourang
