// @ts-check
// Scene registry: each contract's people, optional set dressing and escape animation.
//   people(kit)                      -> CrowdSetup (see people.js)
//   dress(scene, city)               -> { group, colliders, rangeMeshes } added for the contract,
//                                       removed when another contract starts (optional)
//   onEscape(ctx, dt, t)             -> per-frame flourish after the target got away (optional)
import { plazaPeople } from './plaza.js';
import { docksidePeople, docksideDress } from './dockside.js';
import { galaPeople, galaDress, galaReset } from './gala.js';
import { parkPeople, parkDress, parkEscape, parkReset, parkUndress } from './park.js';
import { LAYOUT } from '../city.js';

/**
 * @typedef {{
 *   people: (kit: import('../people.js').CrowdKit) => import('../people.js').CrowdSetup,
 *   dress?: (scene: import('three').Scene, city: any) => Promise<{ group: import('three').Object3D, colliders: number[][], rangeMeshes: import('three').Object3D[] }> | { group: import('three').Object3D, colliders: number[][], rangeMeshes: import('three').Object3D[] },
 *   onEscape?: (ctx: { city: any }, dt: number, t: number) => void,
 *   reset?: (ctx: { city: any }) => void,
 *   undress?: () => void
 * }} SceneDef
 */

/** @type {Record<string, SceneDef>} */
export const SCENES = {
  plaza: {
    people: plazaPeople,
    // Hale's sedan pulls away once he is in it.
    onEscape(ctx, dt, t) {
      ctx.city.targetCar.position.x += dt * Math.min(14, t * 6);
    },
    reset(ctx) {
      const car = ctx.city.targetCar;
      car.position.set(LAYOUT.targetCar.x, car.position.y, LAYOUT.targetCar.z);
    }
  },
  dockside: {
    people: docksidePeople,
    dress: (scene) => docksideDress(scene)
  },
  gala: {
    people: galaPeople,
    dress: (scene) => galaDress(scene),
    // The gala hides that roof's usual clutter; put it back when another contract takes over.
    undress: () => galaReset()
  },
  park: {
    people: parkPeople,
    dress: (scene) => parkDress(scene),
    // Kast's sedan pulls away north once he is in it.
    onEscape: (ctx, dt, t) => parkEscape(dt, t),
    reset: () => parkReset(),
    undress: () => parkUndress()
  }
};
