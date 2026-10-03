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

**Height Gained**:
The sum of every rise along an Itinerary, counted however often the path goes up and down. On a Loop it says how hard the Loop is, where the Elevation Gain is zero.
_Avoid_: D+, Total ascent, Cumulative gain

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
A way of travelling: Running, Trail Running, Road Cycling, Gravel Cycling or Mountain Biking. An Ascent's Activities are derived from its Surface, never chosen for it; a Visitor picks the Activity they want when searching or asking for an Itinerary.
_Avoid_: Sport, Discipline, Mode

### Itineraries

**Itinerary**:
A path ClimbSpot works out on demand over the road and trail network for a Visitor's request, following ways suited to the chosen Activity. It is not catalogued.
_Avoid_: Route, Course, Track, Parcours

**Loop**:
An Itinerary that starts and ends at a point the Visitor places on the map, never shorter than the distance they asked for, with the Relief they chose.
_Avoid_: Round trip, Circuit, Boucle

**Uphill Itinerary**:
An Itinerary that goes up from one point to another, as close as possible to the average Gradient the Visitor asked for and never shorter than the length they asked for. It is not an Ascent unless it is catalogued as one.
_Avoid_: Climb, Suggested Ascent, Montée

**Hill Session**:
A running workout built around one Uphill Itinerary: a Warm-up to its foot, several Repeats of it, each followed by a Recovery, and a Cool-down back to the start.
_Avoid_: Hill repeats, Workout, Intervals, Séance

**Repeat**:
One run up the Uphill Itinerary of a Hill Session, exactly the length the Visitor asked for.
_Avoid_: Rep, Interval, Climb

**Recovery**:
The easy jog back down the Repeat's way to its foot, before the next Repeat.
_Avoid_: Rest, Descent

**Warm-up**:
The way from the Hill Session's starting point to the foot of its Repeats, however long it is.
_Avoid_: Approach

**Cool-down**:
The way back from the foot of the Repeats to the Hill Session's starting point.
_Avoid_: Return

**Relief**:
How much a Loop goes up and down overall, judged by its Height Gained per kilometre: flat, rolling or hilly.
_Avoid_: Terrain, Profile, Difficulty

### Effort

**Km-Effort**:
A running effort in kilometres: the length plus one kilometre for every 100 m of Height Gained. The trail-running standard; only given for running Activities.
_Avoid_: Effort points, Equivalent kilometres

**Flat Pace**:
The pace a Visitor runs on the flat, which they state themselves. Estimated Times are worked out from it.
_Avoid_: Speed, Target pace

**Flat-Equivalent Distance**:
The distance on the flat that costs a runner as much as a path, Gradient by Gradient. Descents count as slightly easier than the flat, never much easier.
_Avoid_: Grade-adjusted distance, Effort distance

**Estimated Time**:
How long a Visitor would take to run a path: its Flat-Equivalent Distance at their Flat Pace. Never shown without a Flat Pace.
_Avoid_: Duration, ETA, Predicted time

### People

**Visitor**:
Anyone searching for Ascents or asking for Itineraries, signed in or not.
_Avoid_: User, Guest

**Contributor**:
A signed-in person who adds Ascents to the catalogue.
_Avoid_: User, Member, Author

## Reserved for later

Climbing sites will arrive as their own concepts (**Crag**, **Gym**, **Route**, **Boulder**). "Climb" is never used for any of them, nor for an Ascent.
