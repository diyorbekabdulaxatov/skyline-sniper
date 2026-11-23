// @ts-check
// Contract 05, Construction Site: the fixed layout (no three.js, so Node tests can check the
// lines of fire). Metres; x east, y up, z south. The site sits north of the downtown towers,
// x -18..58, z -368..-292, with the shooter on the slewing platform of an idle tower crane on
// the empty plot to the west, 42 m up and 95-150 m from the site.

/** Top of the site's gravel; everyone in the yard stands on it. */
export const GROUND_Y = 0.03;

/** The vantage crane: mast centre and the height of its slewing platform's deck. */
export const CRANE = { x: -96, z: -332, deck: 40.6 };
/** The shooter's eye, 1.6 m above the deck, south of the mast, with the rail 0.7 m ahead. */
export const EYE = { x: CRANE.x + 0.8, y: CRANE.deck + 1.6, z: CRANE.z + 2.6 };
/** The platform's front rail (east edge): [x, top y, z0, z1]. */
export const RAIL = { x: EYE.x + 0.7, top: CRANE.deck + 1.0, z0: CRANE.z - 1.4, z1: CRANE.z + 4.0 };

/** The hoarding around the site, the gates in it and its height. */
export const SITE = { x0: -18, x1: 58, z0: -368, z1: -292, h: 2.4 };
export const SOUTH_GATE = { x0: 20, x1: 31 };
export const WEST_GATE = { z0: -314.5, z1: -305.5 };

/** The half-built tower: four storeys of slab and columns, the top one open. */
export const TOWER = { x0: 12, x1: 42, z0: -352, z1: -322 };
/** Slab tops: the ground slab, then floors 1 to 4 (the open floor). */
export const FLOORS = [0.3, 3.8, 7.3, 10.8, 14.3];
export const TOP = FLOORS[4];
export const SLAB = 0.25;
export const COLUMN = 0.5;
export const GRID_X = [12.4, 19.7, 27, 34.3, 41.6];
export const GRID_Z = [-351.6, -344.3, -337, -329.7, -322.4];
/** Formwork for the next storey stands only on the east half of the open floor. */
export const FORMWORK_X = 34;
export const FORMWORK_H = 3.2;
/** The stair and lift core in the north-east corner, and its door on each floor. */
export const CORE = { x0: 37.5, x1: 42, z0: -352, z1: -347, h: TOP + 3.3 };
export const CORE_DOOR = { x: 39.75, z: -346.4 };

/** The builders' hoist on the tower's west face: cage centre, size, mast and stops. */
export const HOIST = { x: 10.5, z: -336, w: 2.4, d: 2.6, mastX: 8.8, top: TOP + 5.5 };
/** Where riders step in at ground level (south side) and out on the open floor (east side). */
export const HOIST_GROUND_DOOR = { x: 10.5, z: -333.2 };
export const HOIST_TOP_DOOR = { x: 13.5, z: -335.6 };

/** Where Darrow stands to show the investors the view. */
export const TALK = { x: 17, z: -328 };

/** The site office: two containers side by side, one stacked on top, doors to the north. */
export const OFFICE = { x0: 2, x1: 14.4, z0: -297.2, z1: -294.8, h: 2.6 };

/** Darrow's black SUV on the road outside the south gate (long axis along x, nose east). */
export const SUV = { x: 37, z: -285.6, len: 4.8, w: 2.0, h: 1.8 };
export const SUV_DOOR = { x: 35.8, z: -287.4 };

/** The site's own tower crane, north of the tower. */
export const SITE_CRANE = { x: 31, z: -362 };

/**
 * The mixer truck: it drives in through the west gate and parks nose-first at the concrete
 * pump, just west of where Darrow stops to watch the pour, then reverses out again.
 */
export const MIXER = {
  len: 9, w: 2.6, h: 3.4,
  route: [{ x: -34, z: -310 }, { x: -20, z: -310 }, { x: -14, z: -318.6 }, { x: -5, z: -318.6 }]
};
/** Where Darrow stops in the yard to watch the pour (the parked mixer hides him from the west). */
export const POUR_STOP = { x: 1.8, z: -318.6 };

/** The forklift shuttles pallets along the west side of the yard. */
export const FORKLIFT = { x: -10.5, z0: -326, z1: -345 };

/** Material stacks: [x, z, w (x), d (z), h]. Concrete pipes, planks and pallets of cement. */
export const STACKS = [
  [-9, -352, 5.6, 3.2, 2.3],
  [47, -306, 6.7, 3.7, 1.2],
  [47.5, -342, 3.7, 5, 1.5],
  [-6, -298.5, 5.6, 3.2, 2.3],
  [54.5, -326, 3.7, 5, 1.5]
];

/** The excavator at the foundation pit for the next block, and its spoil heap. */
export const EXCAVATOR = { x: -2, z: -358, len: 11.9, w: 3.1, h: 3.4 };
export const HEAP = { x: -11.5, z: -362, r: 3.4, h: 2.2 };

/**
 * Static bullet colliders of the site: [minX, minY, minZ, maxX, maxY, maxZ].
 * @returns {number[][]}
 */
export function siteColliders() {
  /** @type {number[][]} */
  const out = [];
  const T = TOWER;
  out.push([T.x0, 0, T.z0, T.x1, FLOORS[0], T.z1]);
  for (let i = 1; i < FLOORS.length; i++) out.push([T.x0, FLOORS[i] - SLAB, T.z0, T.x1, FLOORS[i], T.z1]);
  const h = COLUMN / 2;
  for (let i = 0; i < FLOORS.length - 1; i++) {
    for (const x of GRID_X) {
      for (const z of GRID_Z) {
        if (inCore(x, z)) continue;
        out.push([x - h, FLOORS[i], z - h, x + h, FLOORS[i + 1] - SLAB, z + h]);
      }
    }
  }
  for (const x of GRID_X) {
    if (x < FORMWORK_X) continue;
    for (const z of GRID_Z) {
      if (!inCore(x, z)) out.push([x - 0.35, TOP, z - 0.35, x + 0.35, TOP + FORMWORK_H, z + 0.35]);
    }
  }
  out.push([CORE.x0, 0, CORE.z0, CORE.x1, CORE.h, CORE.z1]);
  // Hoarding, with the south and west gates open.
  const S = SITE;
  const t = 0.12;
  out.push([S.x0, 0, S.z1 - t, SOUTH_GATE.x0, S.h, S.z1]);
  out.push([SOUTH_GATE.x1, 0, S.z1 - t, S.x1, S.h, S.z1]);
  out.push([S.x0, 0, S.z0, S.x1, S.h, S.z0 + t]);
  out.push([S.x1 - t, 0, S.z0, S.x1, S.h, S.z1]);
  out.push([S.x0, 0, S.z0, S.x0 + t, S.h, WEST_GATE.z0]);
  out.push([S.x0, 0, WEST_GATE.z1, S.x0 + t, S.h, S.z1]);
  // Site office: two containers and one stacked on the western one.
  out.push([OFFICE.x0, 0, OFFICE.z0, OFFICE.x1, OFFICE.h, OFFICE.z1]);
  out.push([OFFICE.x0, OFFICE.h, OFFICE.z0, (OFFICE.x0 + OFFICE.x1) / 2, OFFICE.h * 2, OFFICE.z1]);
  for (const [x, z, w, d, hh] of STACKS) out.push([x - w / 2, 0, z - d / 2, x + w / 2, hh, z + d / 2]);
  const E = EXCAVATOR;
  out.push([E.x - E.len / 2, 0, E.z - E.w / 2, E.x + E.len / 2, E.h, E.z + E.w / 2]);
  out.push([HEAP.x - HEAP.r * 0.7, 0, HEAP.z - HEAP.r * 0.7, HEAP.x + HEAP.r * 0.7, HEAP.h * 0.8, HEAP.z + HEAP.r * 0.7]);
  // The SUV.
  out.push([SUV.x - SUV.len / 2, 0, SUV.z - SUV.w / 2, SUV.x + SUV.len / 2, SUV.h, SUV.z + SUV.w / 2]);
  // The crane platform's front rail (the shooter fires over it).
  out.push([RAIL.x - 0.05, CRANE.deck, RAIL.z0, RAIL.x + 0.05, RAIL.top, RAIL.z1]);
  return out;
}

/** True for grid points inside the stair core (no free-standing column there). */
function inCore(x, z) {
  return x > CORE.x0 - 0.3 && z < CORE.z1 + 0.3;
}
