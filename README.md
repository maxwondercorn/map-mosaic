map-mosaic
==========

Stefan Verhoeff

This app will read in an uploaded image and create a mosaic image based on it composed of map tiles. You would be able to render your avatar with tiles from a chosen city.

Planning to use:
- Canvas
- Nokia Map API api.maps.nokia.com

Todo:
X- Github
X- Fetch tiles
  - Load balance between domains
X- Load in canvas
X - Need x-origin proxy?
- try sort by hue
- Slice partial tiles
- Algorithm for matching iomage
  - Calc average color
  - Detect shapes?
  - Greyscales values / hue
- Need cache for rendered tiles
  - Local script
  - Or browser + localStorage?
- Upload & read image
  - Frontend? Canvas?
- Display image
- Use map api to display, zoomable tiles
- Pick bounding box for tiles
  - Random planet
  - City
  - Around lat/lng
  - Select from map, can read tiles directly from map in DOM?


Registration api.map.nokia.com
==============================

Name: MapMosaic
App ID: ayTdeMpluq0EkCHDIplm
Token/AppCode: SxHxfkhbfzGOzF2AeBZTnQ
