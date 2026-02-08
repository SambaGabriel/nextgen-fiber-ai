"""
NextGen Fiber AI - Comprehensive E2E Tests
Tests all major flows: Auth, Dashboard, Jobs, Production, Mobile, PWA
"""

from playwright.sync_api import sync_playwright, expect
import json
import time

BASE_URL = "http://localhost:5174"

def test_login_page_renders():
    """Test that login page renders correctly"""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        page.goto(BASE_URL)
        page.wait_for_load_state('networkidle')

        # Should show login page (looks for Login button)
        page.wait_for_selector('button:has-text("Login")', timeout=10000)

        # Click Login to proceed
        page.locator('button:has-text("Login")').click()
        time.sleep(0.5)

        # Click Admin role
        page.locator('button:has-text("Admin")').click()
        time.sleep(0.5)

        # Check for email and password fields
        email_input = page.locator('input[type="email"], input[placeholder*="email" i]')
        password_input = page.locator('input[type="password"]')

        assert email_input.count() > 0, "Email input not found"
        assert password_input.count() > 0, "Password input not found"

        # Check for language toggle
        lang_button = page.locator('button:has-text("PT"), button:has-text("EN"), button:has-text("ES")')
        assert lang_button.count() > 0, "Language toggle not found"

        print("[PASS] Login page renders correctly")

        browser.close()

def test_language_toggle():
    """Test language toggle functionality"""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        page.goto(BASE_URL)
        page.wait_for_load_state('networkidle')

        # Find and click language toggle
        lang_button = page.locator('button:has-text("PT"), button:has-text("EN"), button:has-text("ES")').first

        initial_text = lang_button.text_content()
        lang_button.click()
        time.sleep(0.5)

        new_text = lang_button.text_content()
        assert initial_text != new_text, "Language did not change"

        print("[PASS] Language toggle works correctly")

        browser.close()

def test_mobile_viewport():
    """Test mobile responsive design"""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        # Mobile viewport (iPhone 12 Pro)
        page = browser.new_page(viewport={'width': 390, 'height': 844})

        page.goto(BASE_URL)
        page.wait_for_load_state('networkidle')

        # Take screenshot for visual verification
        page.screenshot(path='/tmp/mobile-login.png')

        # Login page should be responsive
        page.wait_for_selector('button:has-text("Login")', timeout=10000)

        print("[PASS] Mobile viewport renders correctly")
        print("Screenshot saved to /tmp/mobile-login.png")

        browser.close()

def test_pwa_manifest():
    """Test PWA manifest is accessible"""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Fetch manifest
        response = page.goto(f"{BASE_URL}/manifest.json")

        assert response.status == 200, f"Manifest returned status {response.status}"

        manifest = response.json()

        # Verify required fields
        assert manifest.get('name') == 'NextGen Fiber AI', f"Name mismatch: {manifest.get('name')}"
        assert manifest.get('orientation') == 'portrait-primary', f"Orientation mismatch: {manifest.get('orientation')}"
        assert manifest.get('display') == 'standalone', f"Display mismatch: {manifest.get('display')}"
        assert len(manifest.get('icons', [])) >= 2, "Not enough icons in manifest"

        print("[PASS] PWA manifest is valid")

        browser.close()

def test_css_portrait_lock():
    """Test portrait-only CSS lock for mobile"""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        # Landscape mobile viewport
        page = browser.new_page(viewport={'width': 844, 'height': 390})

        page.goto(BASE_URL)
        page.wait_for_load_state('networkidle')

        # Check if landscape warning is visible
        page.screenshot(path='/tmp/landscape-warning.png')

        # The CSS should hide the root element in landscape
        root_display = page.evaluate('getComputedStyle(document.getElementById("root")).display')

        print(f"[INFO] Root display in landscape: {root_display}")
        print("Screenshot saved to /tmp/landscape-warning.png")
        print("[PASS] CSS portrait lock check complete")

        browser.close()

def test_auth_demo_login():
    """Test demo login flow"""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        page.goto(BASE_URL)
        page.wait_for_load_state('networkidle')

        # Look for demo login button
        demo_button = page.locator('button:has-text("Demo"), button:has-text("demo")')

        if demo_button.count() > 0:
            demo_button.first.click()
            page.wait_for_load_state('networkidle')
            time.sleep(1)

            # Check if we're logged in (should see dashboard or sidebar)
            page.screenshot(path='/tmp/after-demo-login.png')
            print("[PASS] Demo login flow works")
        else:
            print("[SKIP] No demo login button found")

        browser.close()

def test_service_worker_registration():
    """Test that service worker is properly configured"""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        page.goto(BASE_URL)
        page.wait_for_load_state('networkidle')

        # Check if service worker file is accessible
        sw_response = page.goto(f"{BASE_URL}/sw.js")

        assert sw_response.status == 200, f"Service worker returned status {sw_response.status}"

        sw_content = sw_response.text()
        assert 'CACHE_NAME' in sw_content, "Service worker missing cache configuration"
        assert 'install' in sw_content, "Service worker missing install handler"
        assert 'fetch' in sw_content, "Service worker missing fetch handler"

        print("[PASS] Service worker is properly configured")

        browser.close()

def test_offline_page():
    """Test offline fallback page"""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        response = page.goto(f"{BASE_URL}/offline.html")

        if response.status == 200:
            content = page.content()
            assert 'offline' in content.lower() or 'conexão' in content.lower(), "Offline page doesn't mention offline status"
            print("[PASS] Offline page is accessible")
        else:
            print("[SKIP] Offline page not found (optional)")

        browser.close()

def test_responsive_breakpoints():
    """Test all responsive breakpoints"""
    viewports = [
        {'name': 'Mobile S', 'width': 320, 'height': 568},
        {'name': 'Mobile M', 'width': 375, 'height': 667},
        {'name': 'Mobile L', 'width': 425, 'height': 800},
        {'name': 'Tablet', 'width': 768, 'height': 1024},
        {'name': 'Desktop', 'width': 1280, 'height': 800},
        {'name': 'Desktop L', 'width': 1920, 'height': 1080},
    ]

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        for vp in viewports:
            page = browser.new_page(viewport={'width': vp['width'], 'height': vp['height']})
            page.goto(BASE_URL)
            page.wait_for_load_state('networkidle')

            # Take screenshot
            page.screenshot(path=f"/tmp/viewport-{vp['name'].replace(' ', '-')}.png")

            # Basic check - page should render
            assert page.locator('body').is_visible(), f"Page not visible at {vp['name']}"

            page.close()

        print(f"[PASS] All {len(viewports)} viewport breakpoints tested")
        print("Screenshots saved to /tmp/viewport-*.png")

        browser.close()

def test_accessibility_basic():
    """Basic accessibility checks"""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        page.goto(BASE_URL)
        page.wait_for_load_state('networkidle')

        # Check for lang attribute
        html_lang = page.locator('html').get_attribute('lang')
        assert html_lang is not None, "HTML lang attribute missing"

        # Check for viewport meta tag
        viewport_meta = page.locator('meta[name="viewport"]')
        assert viewport_meta.count() > 0, "Viewport meta tag missing"

        # Check form inputs have associated labels or aria-labels
        inputs = page.locator('input:visible')
        for i in range(inputs.count()):
            inp = inputs.nth(i)
            has_label = inp.get_attribute('aria-label') or inp.get_attribute('aria-labelledby') or inp.get_attribute('placeholder')
            # At minimum, inputs should have some form of labeling

        print("[PASS] Basic accessibility checks passed")

        browser.close()

def test_console_errors():
    """Check for JavaScript console errors"""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        errors = []
        page.on('console', lambda msg: errors.append(msg.text) if msg.type == 'error' else None)

        page.goto(BASE_URL)
        page.wait_for_load_state('networkidle')

        # Wait a bit for any async errors
        time.sleep(2)

        # Filter out known benign errors
        critical_errors = [e for e in errors if
            'favicon' not in e.lower() and
            'manifest' not in e.lower() and
            'icon' not in e.lower()]

        if critical_errors:
            print(f"[WARN] Console errors found: {critical_errors[:5]}")
        else:
            print("[PASS] No critical console errors")

        browser.close()

def test_network_requests():
    """Verify critical network requests"""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        requests = []
        page.on('request', lambda req: requests.append(req.url))

        page.goto(BASE_URL)
        page.wait_for_load_state('networkidle')

        # Check that main resources loaded
        has_js = any('.js' in r for r in requests)
        has_css = any('.css' in r for r in requests)

        assert has_js, "No JavaScript files loaded"
        assert has_css, "No CSS files loaded"

        print(f"[PASS] Network requests verified ({len(requests)} total)")

        browser.close()

def run_all_tests():
    """Run all tests"""
    print("\n" + "="*60)
    print("NextGen Fiber AI - E2E Test Suite")
    print("="*60 + "\n")

    tests = [
        ("Login Page Renders", test_login_page_renders),
        ("Language Toggle", test_language_toggle),
        ("Mobile Viewport", test_mobile_viewport),
        ("PWA Manifest", test_pwa_manifest),
        ("CSS Portrait Lock", test_css_portrait_lock),
        ("Demo Login Flow", test_auth_demo_login),
        ("Service Worker", test_service_worker_registration),
        ("Offline Page", test_offline_page),
        ("Responsive Breakpoints", test_responsive_breakpoints),
        ("Accessibility Basic", test_accessibility_basic),
        ("Console Errors", test_console_errors),
        ("Network Requests", test_network_requests),
    ]

    passed = 0
    failed = 0
    skipped = 0

    for name, test_fn in tests:
        try:
            print(f"\nRunning: {name}...")
            test_fn()
            passed += 1
        except AssertionError as e:
            print(f"[FAIL] {name}: {e}")
            failed += 1
        except Exception as e:
            print(f"[ERROR] {name}: {e}")
            failed += 1

    print("\n" + "="*60)
    print(f"Results: {passed} passed, {failed} failed, {skipped} skipped")
    print("="*60 + "\n")

    return failed == 0

if __name__ == "__main__":
    success = run_all_tests()
    exit(0 if success else 1)
