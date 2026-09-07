cmake_minimum_required(VERSION 3.20)
project(4ang-audio-engine VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

# Source files
set(SOURCES
    src/audio_engine.cpp
    src/audio_analyzer.cpp
    src/waveform_analyzer.cpp
    src/loudness_analyzer.cpp
)

set(HEADERS
    include/audio_engine.h
    include/audio_analyzer.h
    include/waveform_analyzer.h
    include/loudness_analyzer.h
)

# Create library
add_library(4ang-audio STATIC ${SOURCES} ${HEADERS})

target_include_directories(4ang-audio PUBLIC
    ${CMAKE_CURRENT_SOURCE_DIR}/include
)

# Tests
option(BUILD_TESTS "Build tests" ON)
if(BUILD_TESTS)
    enable_testing()
    add_executable(audio-engine-tests tests/test_audio_engine.cpp)
    target_link_libraries(audio-engine-tests PRIVATE 4ang-audio)
    add_test(NAME AudioEngineTests COMMAND audio-engine-tests)
endif()

# Benchmarks
option(BUILD_BENCHMARKS "Build benchmarks" OFF)
if(BUILD_BENCHMARKS)
    add_executable(audio-engine-benchmarks benchmarks/bench_audio.cpp)
    target_link_libraries(audio-engine-benchmarks PRIVATE 4ang-audio)
endif()
