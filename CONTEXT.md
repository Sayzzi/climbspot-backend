# ClimbSpot

ClimbSpot helps runners, trail runners and cyclists find uphill paths near them, and lets them catalogue new ones.

## Language

### Ascents

**Ascent**:
A one-way uphill path from a Start to a Top, ridden or run in a single direction. Each side of a mountain is its own Ascent; a descent is never an Ascent.
_Avoid_: Climb, Hill, Segment, Spot, Côte

**Start**:
The lowest point of an Ascent, used to measure how near an Ascent is to someone.
_Avoid_: Origin, Bottom, Trailhead

**Top**:
The highest point of an Ascent, where it ends.
_Avoid_: End, Finish, Peak

**Summit**:
The high point shared by several Ascents (e.g. Mont Ventoux from Bédoin, Malaucène and Sault). Not modelled yet.
_Avoid_: Hill, Mountain, Col

**Elevation Profile**:
The elevations along an Ascent's path, always sampled from the terrain model and smoothed, never taken as-is from what a Contributor provides.
_Avoid_: Altitude data, Elevation track

### Measuring an Ascent

**Gradient**:
Elevation change divided by horizontal distance, expressed as a percentage. An Ascent has an average Gradient and a maximum Gradient.
_Avoid_: Slope, Grade, Incline, Pente

**Elevation Gain**:
The height difference between an Ascent's Top and its Start; descending stretches in between are not added back.
_Avoid_: Climbing, Vertical, Cumulative gain, Dénivelé

**Dip**:
A descending stretch inside an Ascent. Small Dips are tolerated; an Ascent that loses too much height along the way is two Ascents.
_Avoid_: Drop, False flat, Descent

**Difficulty Score**:
A number computed from an Ascent's length and average Gradient; never entered by anyone.
_Avoid_: Rating, Grade, Level

**Category**:
The band an Ascent falls into based on its Difficulty Score: Uncategorized, Cat 4, Cat 3, Cat 2, Cat 1 or HC.
_Avoid_: Grade, Class, Cotation

### Surfaces and activities

**Surface**:
The dominant ground type of an Ascent: paved, gravel or trail.
_Avoid_: Terrain, Ground, Road type

**Activity**:
A way of travelling an Ascent: Running, Trail Running, Road Cycling, Gravel Cycling or Mountain Biking. Always derived from the Surface, never chosen directly.
_Avoid_: Sport, Discipline, Mode

### People

**Visitor**:
Anyone searching for Ascents, signed in or not.
_Avoid_: User, Guest

**Contributor**:
A signed-in person who adds Ascents to the catalogue.
_Avoid_: User, Member, Author

## Reserved for later

Climbing sites will arrive as their own concepts (**Crag**, **Gym**, **Route**, **Boulder**). "Climb" is never used for any of them, nor for an Ascent.
