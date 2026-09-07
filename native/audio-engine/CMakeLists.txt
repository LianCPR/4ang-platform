cmake_minimum_required(VERSION 3.20)
project(4ang-audio-engine VERSION 4.3.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

# ═══════════════════════════════════════════════════════════════════
# ENGINE VERSION
# ═══════════════════════════════════════════════════════════════════
set(FOURANG_ENGINE_VERSION "4.3.0")
set(FOURANG_ANALYSIS_SCHEMA_VERSION "1")
add_compile_definitions(
    FOURANG_ENGINE_VERSION="${FOURANG_ENGINE_VERSION}"
    FOURANG_ANALYSIS_SCHEMA_VERSION="${FOURANG_ANALYSIS_SCHEMA_VERSION}"
)

# ═══════════════════════════════════════════════════════════════════
# LIBRARY SOURCES
# ═══════════════════════════════════════════════════════════════════
set(FOURANG_SOURCES
    src/audio_buffer.cpp
    src/waveform.cpp
    src/loudness.cpp
    src/spectrum.cpp
    src/bpm.cpp
    src/features.cpp
    src/analysis.cpp
    src/fourang_capi.cpp
)

set(FOURANG_HEADERS
    include/fourang/audio_buffer.hpp
    include/fourang/waveform.hpp
    include/fourang/loudness.hpp
    include/fourang/spectrum.hpp
    include/fourang/bpm.hpp
    include/fourang/features.hpp
    include/fourang/analysis.hpp
    include/fourang/version.hpp
    include/fourang/fourang_capi.h
)

# ═══════════════════════════════════════════════════════════════════
# STATIC LIBRARY
# ═══════════════════════════════════════════════════════════════════
add_library(fourang-audio STATIC ${FOURANG_SOURCES} ${FOURANG_HEADERS})

target_include_directories(fourang-audio PUBLIC
    ${CMAKE_CURRENT_SOURCE_DIR}/include
)

# Math library
target_link_libraries(fourang-audio PRIVATE m)

# ═══════════════════════════════════════════════════════════════════
# TESTS
# ═══════════════════════════════════════════════════════════════════
option(FOURANG_BUILD_TESTS "Build tests" ON)
if(FOURANG_BUILD_TESTS)
    enable_testing()

    set(TEST_SOURCES
        tests/test_audio_buffer.cpp
        tests/test_waveform.cpp
        tests/test_loudness.cpp
        tests/test_spectrum.cpp
        tests/test_bpm.cpp
        tests/test_features.cpp
        tests/test_analysis.cpp
        tests/test_main.cpp
    )

    add_executable(fourang-tests ${TEST_SOURCES})
    target_link_libraries(fourang-tests PRIVATE fourang-audio)
    add_test(NAME FourAngTests COMMAND fourang-tests)
endif()

# ═══════════════════════════════════════════════════════════════════
# CLI ANALYZER
# ═══════════════════════════════════════════════════════════════════
option(FOURANG_BUILD_CLI "Build CLI analyzer" ON)
if(FOURANG_BUILD_CLI)
    add_executable(fourang-analyzer tools/audio_analyzer.cpp)
    target_link_libraries(fourang-analyzer PRIVATE fourang-audio)
endif()

# ═══════════════════════════════════════════════════════════════════
# BUILD CONFIGURATIONS
# ═══════════════════════════════════════════════════════════════════
if(CMAKE_BUILD_TYPE STREQUAL "Release")
    target_compile_options(fourang-audio PRIVATE -O3 -DNDEBUG)
    target_compile_options(fourang-analyzer PRIVATE -O3 -DNDEBUG)
endif()

if(CMAKE_BUILD_TYPE STREQUAL "Debug")
    target_compile_options(fourang-audio PRIVATE -g -O0 -Wall -Wextra)
    target_compile_options(fourang-analyzer PRIVATE -g -O0 -Wall -Wextra)
    target_compile_options(fourang-tests PRIVATE -g -O0 -Wall -Wextra)
endif()
