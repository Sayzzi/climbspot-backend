---
status: proposed
---

# Difficulty Score and Categories

Difficulty is computed on the server when an Ascent is saved and never entered by anyone. The **Difficulty Score** is the Ascent's length in metres multiplied by its average Gradient in percent, rounded to the nearest integer, and the **Category** is derived from it using the thresholds popularised by Strava: Uncategorized below 8,000, Cat 4 from 8,000, Cat 3 from 16,000, Cat 2 from 32,000, Cat 1 from 64,000 and HC from 80,000.

Unlike cycling apps, we keep short, steep hills that runners use for hill repeats: anything with an average Gradient of at least 3 % and an Elevation Gain of at least 10 m is an Ascent, and most of them are Uncategorized. Elevation Gain is the Top minus the Start. The height lost in Dips along the way may not exceed 10 % of the Elevation Gain or 10 m, whichever is larger; beyond that, the path must be split into two Ascents.

The Dip threshold and the minimum criteria are provisional and must be calibrated against real Ascents before this decision is accepted. Changing them later means recomputing every stored Ascent.
