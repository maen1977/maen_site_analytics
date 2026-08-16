# External verification: beIN open frequency

Checked on 2026-08-16.

## Sources

1. Official beIN frequencies page: https://www.bein.com/en/frequencies/
   The extracted page lists a beIN frequency at 12245 MHz, Vertical, SR 27500, FEC 2/3, DVB-S2, 8PSK. The page extraction was partially affected by an extension block, so it is used as supporting evidence rather than the sole source.

2. LyngSat BeIn Sports News: https://www.lyngsat.com/tvchannels/qa/BeIn-Sports-News.html
   Extracted page states it was last updated 2026-08-15 and lists BeIn Sports News as clear on Eutelsat 7 West A at 12245 V, DVB-S2 8PSK, SR 27500, FEC 2/3. It also lists the older 25.8E 10810 V entry.

3. LyngSat BeIn package: https://www.lyngsat.com/packages/BeIn-26E.html
   Extracted page states it was last updated 2026-08-15 and identifies the beIN package entries and Videoguard encryption for subscription channels; the page confirms that clear and encrypted access are distinct states.

## Data finding

The site data had an old Nilesat/Eutelsat E7WA row at 12187 H containing BeIN Sports News marked free, while the current LyngSat page lists the channel at 12245 V. The data also had a separate 12245 V E7WB row with encrypted beIN channels.

## Correction applied locally

A new Nilesat/Eutelsat E7WA 12245 V row was added for BeIN Sports News as free, with source URL and checked date. The stale 12187 H row retained its other encrypted channels but no longer includes BeIN Sports News. Frequency assets were regenerated, including the Nilesat/FTA shard.
