# My Dream House

A playful isometric house designer for Charlotte & Thomas, built with Three.js, GSAP and Vite.

## Commands

```sh
npm install        # once, after cloning
npm run dev        # local preview at http://localhost:5173, reloads on save
npm run lint       # catches typos and missing imports
npm run build      # production files in dist/
npm run preview    # serve dist/ locally to check the build
```

## Layout

- `index.html`, `src/styles.css`: page and styling
- `src/main.js`: entry point and render loop
- `src/config.js`: palette, styles, names (`HOME`), the design `state`
- `src/house.js`, `src/island.js`, `src/greenery.js`: the generated scene
- `src/world.js`: builds the scene from `state` and animates changes
- `src/props.js`, `src/catalog.js`: garden models and the "Add to garden" catalog
- `src/items.js`, `src/drag.js`, `src/ui/shop.js`: placing, dragging and the menu
- `public/assets/props/`: Kenney models (CC0, see `LICENSE-kenney.txt`)
- `tools/`: test pages for development

## Netlify

Push the folder to a Git repository and import it in Netlify. `netlify.toml`
already sets the build command (`npm run build`) and folder (`dist`). Or run
`npm run build` and drag `dist/` onto Netlify's deploy page.
