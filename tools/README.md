# Test pages

Used during development with `npm run dev`; not part of the site.

- `_test.html` opens the app in a frame and clicks buttons, e.g.
  `/tools/_test.html?at=3000&ids=act-random,act-rotate&start=style%3Dcastle`
- `_drag.html` drags the garden sets around with simulated pointer events and logs the result.
- `_handles.html` taps the house and drags its shape handles, logging the room layout
  after each step; add `?only&cells=0,0;1,0;1,1` to just show the handles on a shape.
- `_migrate.html` saves a design in the old (rooms × floors) format and opens the app,
  to check that it converts.

Any page can start from a shape with `cells=column,floor;...`, e.g.
`/index.html?skipstart&cells=0,0;0,1;1,1;2,0;2,1` (a terrace in the middle).
- `_rooms.html` taps rooms and roofs, picks options in the chooser (bay, balcony,
  dormer, garage door, moving the front door) and logs the result.

Fronts and roof extras can also be set in the address:
`?fronts=0,0:garage;1,1:balcony&roofs=0:dormer;1:chimney`.
- `_zoom.html` zooms with the buttons and the wheel, pans by dragging the lawn, then taps the house.
- `_roofterrace.html` makes a roof terrace, drags a sun lounger onto it and logs whether it stands up there (`?style=modern` etc.).
- `_water.html` paints a river from the edge and a pond with the water brush, then wipes part of it (`?start=night%3D1%26style%3Dbeach` etc.).
