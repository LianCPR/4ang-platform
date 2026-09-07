/**
 * 4ang Audio Engine — C API
 *
 * C-compatible interface for cross-language integration.
 * Suitable for Python, Node.js, WASM bindings.
 */

#pragma once

#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/**
 * Opaque handle to analysis result.
 */
typedef struct fourang_result fourang_result_t;

/**
 * Opaque handle to audio buffer.
 */
typedef struct fourang_buffer fourang_buffer_t;

/**
 * Version info.
 */
typedef struct {
    const char* engine_version;
    int analysis_schema_version;
} fourang_version_t;

/**
 * Get engine version.
 */
fourang_version_t fourang_version(void);

/**
 * Create an audio buffer from float data.
 * @param data Sample data (interleaved or planar)
 * @param num_frames Number of frames
 * @param num_channels Number of channels
 * @param sample_rate Sample rate
 * @return Buffer handle (must be freed with fourang_buffer_free)
 */
fourang_buffer_t* fourang_buffer_create(
    const float* data,
    size_t num_frames,
    int num_channels,
    double sample_rate
);

/**
 * Free an audio buffer.
 */
void fourang_buffer_free(fourang_buffer_t* buffer);

/**
 * Get buffer info.
 */
size_t fourang_buffer_frames(const fourang_buffer_t* buffer);
int fourang_buffer_channels(const fourang_buffer_t* buffer);
double fourang_buffer_sample_rate(const fourang_buffer_t* buffer);
double fourang_buffer_duration(const fourang_buffer_t* buffer);

/**
 * Analyze audio buffer.
 * @param buffer Input buffer
 * @param result Output result handle (must be freed)
 * @return 0 on success, negative on error
 */
int fourang_analyze(const fourang_buffer_t* buffer, fourang_result_t** result);

/**
 * Free analysis result.
 */
void fourang_result_free(fourang_result_t* result);

/**
 * Get result as JSON string.
 * @param result Analysis result
 * @return JSON string (must be freed with fourang_string_free)
 */
char* fourang_result_to_json(const fourang_result_t* result);

/**
 * Free a string returned by the engine.
 */
void fourang_string_free(char* str);

/**
 * Get error message for an error code.
 */
const char* fourang_error_message(int error_code);

#ifdef __cplusplus
}
#endif
