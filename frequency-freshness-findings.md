# Frequency freshness findings

## External source evidence

- KingOfSat current Nilesat/Eutelsat 7W page: https://en.kingofsat.net/freqs.php?&b=251&pos=7W&standard=Digital&ordre=date_maj&filtre=no&aff=zap
  - Page reports 259 records and latest updates sorted by date.
  - beIN Sports News HD is listed on Eutelsat 7 West A at 12245.50 MHz, V, DVB-S2, 8PSK, 27500, FEC 2/3, Clear; update 2026-08-14.
  - Several additional rows on 12245.50 MHz are marked new frequency on 2026-08-14.

- LyngSat Nilesat/Eutelsat 7W page: https://www.lyngsat.com/Nilesat-201-301-and-Eutelsat-7-West-A.html
  - Page states last updated 2026-08-15.

- Official Nilesat channels page: https://nilesat.org/channels/
  - Page exposes 530 entries and includes current rows such as 11747 V, 11785 V, 11823 V, 11862 V, 11900 V, 11938 V, 11977 V, and 12015 V with SR/FEC 27500 5/6.

- LyngSat Badr 8 page: https://www.lyngsat.com/Badr-8.html
  - Page states last updated 2026-08-15.

## Local workflow evidence

- `public/frequencies/latest-frequency-update-report.json` was generated at 2026-08-16T21:00:03Z.
- It checked 67 sources, but only 48 were successful and 19 failed.
- It produced 2537 candidates, yet `incompleteNewSkipped` was 2396 and only 1 candidate was added. This means the workflow technically succeeded while refusing most new rows because the parser lost system/mod fields.
- The live parser audit showed:
  - Nilesat official: 105 candidates, 0 complete.
  - LyngSat Nilesat 7W: 153 candidates, only 26 complete.
  - KingOfSat 7W before fix: 85 candidates, 0 complete, with SR incorrectly read as the frequency and channel names such as VPID/5/6.
- The raw KingOfSat HTML contains structured frequency rows, for example 12245.50 V, DVB-S2, 8PSK, 27500, 2/3, followed by channel rows with class `cl` for clear and `cr` for encrypted.
- Root parser defect found: `normalizeFrequency` used `Math.round`, turning 12245.50 into 12246; the canonical receiver/site value should use the integer MHz part 12245. This was changed to `Math.floor`.
- A specialized KingOfSat parser was added to preserve frequency, polarity, system, modulation, SR, FEC, channel names, and per-channel encryption status. It is guarded by KingOfSat source URL/name and falls back to the existing parser for other sources.
