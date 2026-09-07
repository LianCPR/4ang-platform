/**
 * 4ang Audio Engine — C API Implementation
 *
 * C-compatible interface for cross-language integration.
 */

#include "fourang/fourang_capi.h"
#include "fourang/audio_buffer.hpp"
#include "fourang/analysis.hpp"
#include <cstring>
#include <cstdlib>
#include <string>

// ═══════════════════════════════════════════════════════════════════
// Opaque types
// ═══════════════════════════════════════════════════════════════════

struct fourang_buffer {
    fourang::AudioBuffer* impl;
};

struct fourang_result {
    fourang::AnalysisResult* impl;
};

// ═══════════════════════════════════════════════════════════════════
// Version
// ═══════════════════════════════════════════════════════════════════

fourang_version_t fourang_version(void) {
    return {
        fourang::ENGINE_VERSION,
        fourang::ANALYSIS_SCHEMA_VERSION
    };
}

// ═══════════════════════════════════════════════════════════════════
// Buffer
// ═══════════════════════════════════════════════════════════════════

fourang_buffer_t* fourang_buffer_create(
    const float* data,
    size_t num_frames,
    int num_channels,
    double sample_rate
) {
    if (!data || num_frames == 0 || num_channels <= 0) {
        return nullptr;
    }

    try {
        auto* buf = new fourang_buffer;
        buf->impl = new fourang::AudioBuffer(data, num_frames, num_channels, sample_rate);
        return buf;
    } catch (...) {
        return nullptr;
    }
}

void fourang_buffer_free(fourang_buffer_t* buffer) {
    if (buffer) {
        delete buffer->impl;
        delete buffer;
    }
}

size_t fourang_buffer_frames(const fourang_buffer_t* buffer) {
    return buffer && buffer->impl ? buffer->impl->num_frames() : 0;
}

int fourang_buffer_channels(const fourang_buffer_t* buffer) {
    return buffer && buffer->impl ? buffer->impl->num_channels() : 0;
}

double fourang_buffer_sample_rate(const fourang_buffer_t* buffer) {
    return buffer && buffer->impl ? buffer->impl->sample_rate() : 0.0;
}

double fourang_buffer_duration(const fourang_buffer_t* buffer) {
    return buffer && buffer->impl ? buffer->impl->duration_seconds() : 0.0;
}

// ═══════════════════════════════════════════════════════════════════
// Analysis
// ═══════════════════════════════════════════════════════════════════

int fourang_analyze(const fourang_buffer_t* buffer, fourang_result_t** result) {
    if (!buffer || !buffer->impl || !result) {
        return -1; // INVALID_ARGUMENT
    }

    try {
        fourang::AudioAnalyzer analyzer;
        auto analysis_result = analyzer.analyze(*buffer->impl);

        auto* res = new fourang_result;
        res->impl = new fourang::AnalysisResult(std::move(analysis_result));
        *result = res;

        return res->impl->success ? 0 : -2; // 0 = success, -2 = ANALYSIS_FAILED
    } catch (...) {
        return -3; // INTERNAL_ERROR
    }
}

void fourang_result_free(fourang_result_t* result) {
    if (result) {
        delete result->impl;
        delete result;
    }
}

char* fourang_result_to_json(const fourang_result_t* result) {
    if (!result || !result->impl) {
        return nullptr;
    }

    std::string json = result->impl->to_json();
    char* str = static_cast<char*>(std::malloc(json.size() + 1));
    if (str) {
        std::memcpy(str, json.c_str(), json.size() + 1);
    }
    return str;
}

void fourang_string_free(char* str) {
    std::free(str);
}

const char* fourang_error_message(int error_code) {
    switch (error_code) {
        case 0: return "Success";
        case -1: return "Invalid argument";
        case -2: return "Analysis failed";
        case -3: return "Internal error";
        default: return "Unknown error";
    }
}
