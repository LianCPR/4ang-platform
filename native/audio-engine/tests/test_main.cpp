/**
 * 4ang Audio Engine — Test Main
 *
 * Minimal test framework for C++ tests.
 */

#include <iostream>
#include <string>
#include <vector>
#include <functional>
#include <cmath>

struct TestCase {
    std::string name;
    std::function<void()> fn;
};

static std::vector<TestCase>& tests() {
    static std::vector<TestCase> t;
    return t;
}

static int passed = 0;
static int failed = 0;

#define TEST(name) \
    static void test_##name(); \
    static struct Register_##name { \
        Register_##name() { tests().push_back({#name, test_##name}); } \
    } reg_##name; \
    static void test_##name()

#define ASSERT_TRUE(cond) do { \
    if (!(cond)) { \
        std::cerr << "  FAIL: " << #cond << " at " << __FILE__ << ":" << __LINE__ << std::endl; \
        failed++; \
        return; \
    } \
} while(0)

#define ASSERT_FALSE(cond) ASSERT_TRUE(!(cond))

#define ASSERT_EQ(a, b) do { \
    if ((a) != (b)) { \
        std::cerr << "  FAIL: " << #a << " == " << #b << " at " << __FILE__ << ":" << __LINE__ << std::endl; \
        failed++; \
        return; \
    } \
} while(0)

#define ASSERT_NEAR(a, b, eps) do { \
    if (std::abs((a) - (b)) > (eps)) { \
        std::cerr << "  FAIL: |" << #a << " - " << #b << "| > " << #eps << " at " << __FILE__ << ":" << __LINE__ << std::endl; \
        failed++; \
        return; \
    } \
} while(0)

int main() {
    std::cout << "=== 4ang Audio Engine Tests ===" << std::endl;

    for (auto& tc : tests()) {
        std::cout << "Running: " << tc.name << " ... ";
        int before = failed;
        try {
            tc.fn();
        } catch (const std::exception& e) {
            std::cerr << "EXCEPTION: " << e.what() << std::endl;
            failed++;
        }
        if (failed == before) {
            std::cout << "PASS" << std::endl;
            passed++;
        }
    }

    std::cout << "\n=== Results: " << passed << " passed, " << failed << " failed ===" << std::endl;
    return failed > 0 ? 1 : 0;
}
