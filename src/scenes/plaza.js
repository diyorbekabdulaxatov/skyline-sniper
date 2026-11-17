// @ts-check
// Contract 01, Harbor Plaza: midday crowd on the plaza, a contact on the phone by the fountain,
// and Victor Hale walking from Meridian Tower to the fountain and back to his car.
import { LAYOUT } from '../city.js';
import { TARGET_AVATAR, CONTACT_AVATAR } from '../people.js';

/**
 * @param {import('../people.js').CrowdKit} kit
 * @returns {import('../people.js').CrowdSetup}
 */
export function plazaPeople(kit) {
  const { r, passerby, make, avatar, rect, ring } = kit;
  const civilians = [];
  const routes = [
    { pts: rect(-34, -32, 34, -98), loop: true },
    { pts: [{ x: -34, z: -32 }, { x: -15, z: -50 }, { x: -30, z: -98 }, { x: 30, z: -98 }, { x: 15, z: -74 }, { x: 34, z: -32 }], loop: true },
    { pts: ring(LAYOUT.fountain.x, LAYOUT.fountain.z, 14.5, 14), loop: true },
    { pts: [{ x: -120, z: -24 }, { x: 120, z: -24 }], loop: false },
    { pts: [{ x: -120, z: -106 }, { x: 120, z: -106 }], loop: false },
    { pts: [{ x: -120, z: -124 }, { x: 120, z: -124 }], loop: false },
    { pts: [{ x: -120, z: -4 }, { x: 120, z: -4 }], loop: false }
  ];
  for (let i = 0; i < 24; i++) {
    const route = routes[i % routes.length];
    const p = passerby();
    p.idleRole = r() < 0.5 ? 'idle' : 'idle2';
    if (route.loop) {
      const start = Math.floor(r() * route.pts.length);
      const s = route.pts[start];
      const n = route.pts[(start + 1) % route.pts.length];
      const t = r();
      p.place(s.x + (n.x - s.x) * t, s.z + (n.z - s.z) * t, 0);
      p.walk(route.pts, { loop: true, speed: 1.1 + r() * 0.45, start: (start + 1) % route.pts.length, dir: 1 });
    } else {
      // Straight sidewalk routes walk back and forth.
      p.place(-120 + r() * 240, route.pts[0].z, 0);
      p.walk(route.pts, { loop: true, speed: 1.1 + r() * 0.45, start: r() < 0.5 ? 0 : 1, dir: 1 });
    }
    civilians.push(p);
  }
  // Pairs standing and talking: one speaks, the other listens.
  for (const [x, z] of [[-20, -40], [22, -88], [-25, -90], [20, -38]]) {
    const a = passerby();
    const b = passerby();
    a.place(x - 0.6, z, Math.PI / 2);
    b.place(x + 0.6, z, -Math.PI / 2);
    a.standStill(Math.PI / 2, 'talk');
    b.standStill(-Math.PI / 2, r() < 0.5 ? 'idle' : 'idle2');
    civilians.push(a, b);
  }
  // A few people stopped on their phones near the benches.
  for (const [x, z, face] of [[-12, -50, 0.6], [13, -46, -2.4], [-30, -70, 1.4]]) {
    const p = passerby();
    p.place(x, z, face);
    p.standStill(face, 'phone');
    civilians.push(p);
  }

  // The contact waits by the fountain on the phone, facing north toward Meridian Tower.
  const contact = make(avatar(CONTACT_AVATAR), { suit: '#7b6a55', trousers: '#3b3f45', skin: '#c68e6e', hair: '#1a1410', tie: '#3c3c3c' }, 1.76);
  contact.place(6.5, -79, Math.PI);
  contact.standStill(Math.PI, 'phone');
  civilians.push(contact);

  // The target: checked brown-grey suit, dark red shirt (Male_Adult_03).
  const targetLook = { suit: '#6e7378', trousers: '#2d3138', skin: '#e0b49a', hair: '#3b2a1e', tie: '#b3261e', avatar: TARGET_AVATAR };
  const target = make(avatar(TARGET_AVATAR), targetLook, 1.82);
  const door = LAYOUT.meridianDoor;
  target.place(door.x, door.z, 0);
  const car = LAYOUT.targetCar;
  const carDoor = { x: car.x - 2.4, z: car.z + 1.2 };
  const meeting = { x: 5.2, z: -81 };
  target.walk([
    { x: door.x, z: door.z + 1 },
    { x: 9, z: -115 },
    { x: 8, z: -104.5 },
    { x: 6.5, z: -90 },
    { x: meeting.x, z: meeting.z, wait: 26, anim: 'talk' },
    { x: 11, z: -93 },
    { x: 18, z: -103 },
    { x: carDoor.x, z: -106.8 },
    { x: carDoor.x, z: carDoor.z }
  ], { loop: false, speed: 1.25 });

  const exits = [
    { x: -60, z: -20 }, { x: 60, z: -20 }, { x: -60, z: -110 }, { x: 60, z: -110 },
    { x: -130, z: -24 }, { x: 130, z: -24 }, { x: -130, z: -106 }, { x: 130, z: -106 },
    { x: -130, z: -4 }, { x: 130, z: -4 }, { x: door.x, z: door.z }
  ];

  return {
    civilians,
    target,
    targetLook,
    contact,
    exits,
    panicTarget(t) {
      t.path = [{ x: 18, z: -103 }, carDoor];
      t.index = 0;
      t.loop = false;
      t.wait = 0;
      t.speed = 4.4;
      t.mode = 'walk';
      t.panicDelay = 0.35;
    },
    update() {
      // The contact hangs up and talks while the target stands with him.
      if (contact.alive && contact.mode === 'idle') {
        const meetingNow = target.alive && target.wait > 0 && Math.hypot(target.x - meeting.x, target.z - meeting.z) < 0.5;
        contact.setIdle(meetingNow ? 'talk' : target.index > 4 ? 'idle' : 'phone');
      }
    },
    escaped() {
      return target.mode === 'idle' && target.index === target.path.length - 1 &&
        Math.hypot(target.x - carDoor.x, target.z - carDoor.z) < 0.5;
    }
  };
}
