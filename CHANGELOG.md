# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project follows Semantic Versioning.

## [Unreleased]

### Changed
- Updated AQI calculation to use the Israeli AQI breakpoint formula and final `100 - subIndex` score.
- Updated AQI legend ranges and gauge ticks to match the Israeli AQI scale.
- Prefer an official integration AQI/index sensor for the main gauge when available, with pollutant calculation as fallback.
- Treat Air Sviva sentinel values (`-9999`, `9999`) as unavailable readings.

## [1.1.0] - 2026-06-24

### Added
- Added a dedicated `CHANGELOG.md` for version history.
- Added GitHub release notes configuration in `.github/release.yml`.
- Added links in README for latest release and changelog.

### Changed
- Standardized release process for future versions using tags + GitHub Releases.

## [1.0.1] - 2026-06-24

### Fixed
- Fixed metric card layout so pollutant/weather names remain visible.

## [1.0.0] - 2026-06-24

### Added
- Initial public release of the Air Sviva Dashboard Card.
- AQI gauge with dominant pollutant logic.
- Pollutant and weather metric cards.
- Navigation and back button support.
- README documentation and preview image.
