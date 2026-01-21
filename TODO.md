# TODO: Handle First Time Launch and Onboarding

## Completed Tasks
- [x] Remove premature setting of "hasLaunched" flag in navigation.tsx checkAppState
- [x] Remove onboarding handling from SplashScreen.tsx, keep only auth logic
- [x] Add setting "hasLaunched" to "true" in OnboardingScreen.tsx when completed or skipped
- [x] Implement resetOnboarding function in navigation.tsx for redesign purposes
- [x] Add language selection button in top left corner of onboarding screen with modal

## Summary
- Navigation now correctly detects first launch and shows onboarding only once.
- SplashScreen focuses solely on authentication checks.
- Onboarding completion properly sets the launch flag to prevent future shows.
- Added resetOnboarding function for development/testing.
- Users can change language during onboarding if initially selected wrongly.
