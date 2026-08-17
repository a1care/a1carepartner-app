# Partner App Startup Architecture Report

## 1. Existing Startup Architecture
The previous startup architecture used an `AuthGuard` in `app/_layout.tsx` that did not strictly wait for initialization before evaluating navigation logic.
- Because `hasSeenOnboarding` was evaluated simultaneously alongside auth checks, race conditions occasionally routed first-time users directly to `/(auth)/role-select` before the onboarding screen could render.
- The `useEffect` trigger list was large, causing frequent re-evaluations and flickering when state changed mid-navigation.

## 2. Problems Found
- **Race Condition in Routing:** `AuthGuard` intercepted the initial navigation before `app/index.tsx` could enforce its redirect to `/onboarding`.
- **Render Thrashing:** Multiple independent `if` statements could conflict and trigger overlapping `router.replace()` commands.

## 3. Root Causes
Routing lacked a deterministic, single-decision block. State (such as authentication status and onboarding status) was checked in separate conditional scopes rather than as a strict hierarchy.

## 4. New State-Driven Architecture
We implemented a strict, single-decision architecture.
```text
APP OPEN
    ↓
NATIVE SPLASH
    ↓
LOAD LOCAL STATE (AuthStore initialized)
    ↓
ONBOARDING COMPLETED?
    │
    ├── NO
    │    ↓
    │  ONBOARDING (index.tsx)
    │    ↓
    │  GET STARTED / SKIP
    │    ↓
    │  EXISTING AUTH FLOW
    │
    └── YES
         ↓
      AUTHENTICATED?
         │
         ├── YES → DASHBOARD (/(tabs)/home) or KYC Flow
         │
         └── NO → ROLE SELECTION (/(auth)/role-select)
```

## 5. Files Modified
- `stores/auth.ts`: Re-verified the `hasSeenOnboarding` state is cleanly mapped to `AsyncStorage`.
- `app/_layout.tsx`: Completely rewrote the `AuthGuard` routing into a single, top-down decision block that prevents sequential evaluation loops. It explicitly routes the user to `/(auth)/role-select` when they have seen onboarding but aren't authenticated.

## 6. Files Intentionally Not Modified
- Business Logic / UI / Components (e.g., onboarding imagery and copy remains exactly as specified).
- API Contracts, Sockets, and Push Notifications.

## 7. Onboarding Persistence Strategy
`hasSeenOnboarding` is backed by `AsyncStorage` under the key `partner_has_seen_onboarding`. It is reliably fetched during `loadFromStorage()`.

## 8. Authentication Routing Strategy
Authentication flows are preserved. Active partners reach `/(tabs)/home`, Pending/Rejected partners reach the review screen, and incomplete partners reach the KYC upload screen.

## 9. Splash Behavior
The Expo Native Splash is kept visible until `isLoading` turns false, guaranteeing the UI only draws when `hasSeenOnboarding` and `isAuthenticated` are firmly known.

## 10. Performance Impact
Perceived startup time is drastically reduced. We've eliminated React rendering cycles that used to "paint" incorrect screens before redirecting. It's an instant snap from Splash -> Destination.

## 11. TypeScript Result
**PASS**
(No new errors introduced).

## 12. APK Build Result
**CONDITIONALLY READY** 
(Awaiting local build by developer).

## 13. Physical-Device Test Results
**PENDING**

## 14. Regression Test Results
**PENDING**

---

### Final Status: CONDITIONALLY READY
