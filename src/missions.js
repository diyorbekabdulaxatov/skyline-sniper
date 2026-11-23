// @ts-check
// Contracts. Each reuses the same city with its own sniper position (vantage), time of day,
// people (scenes/*.js) and rules. A contract unlocks when the one before it is completed.

/**
 * @typedef {{ at: number, text: string }} Intel
 * @typedef {{
 *   id: string, number: number, title: string, district: string, briefing: string,
 *   target: { name: string, description: string },
 *   scene: 'plaza' | 'dockside' | 'gala' | 'market',
 *   lighting: 'golden' | 'sunset' | 'dusk' | 'morning',
 *   vantage: { eye: { x: number, y: number, z: number }, yaw: number, pitch: number,
 *     yawRange: number, pitchMin: number, pitchMax: number, focus: { x: number, z: number } },
 *   wind: { base: number, gust: number },
 *   stars: string[], intel: Intel[], panicIntel: string,
 *   results: { win: string, winHead: string, escaped: string, civilian: string },
 *   seed: number
 * }} Mission
 */

/** @type {Mission[]} */
export const MISSIONS = [
  {
    id: 'harbor-plaza',
    number: 1,
    title: 'Harbor Plaza',
    district: 'Financial District, 14:20',
    briefing:
      'Victor Hale launders money for the people who own the harbour. In a few minutes he leaves Meridian Tower, meets a contact at the plaza fountain and walks back to his car. You are on the roof across the avenue. One clean shot, no civilians.',
    target: {
      name: 'Victor Hale',
      description: 'Checked brown-grey suit, dark red shirt, no tie. Leaves Meridian Tower, talks with a contact at the fountain, then returns to a black sedan on Meridian Street.'
    },
    scene: 'plaza',
    lighting: 'golden',
    vantage: { eye: { x: 0, y: 43.7, z: -1.0 }, yaw: 0, pitch: -0.42, yawRange: 1.25, pitchMin: -0.95, pitchMax: 0.35, focus: { x: 0, z: -70 } },
    wind: { base: 1.6, gust: 1.2 },
    stars: ['Eliminate the target', 'Headshot', 'One shot, no misses'],
    intel: [
      { at: 0, text: 'Hale is leaving Meridian Tower now. Checked brown-grey suit, dark red shirt.' },
      { at: 9, text: 'His contact is the man on the phone by the fountain. Wait for Hale to stop and talk.' },
      { at: 22, text: 'The rangefinder reads the distance under the cross. At this range the drop is small.' },
      { at: 40, text: 'If he gets back to his car, the contract is lost.' }
    ],
    panicIntel: 'He heard the shot. He is running for the car!',
    results: {
      win: 'Hale is down. The harbour has one less banker.',
      winHead: 'One shot to the head. Hale never reached his car.',
      escaped: 'Hale reached his car and is gone. He will be twice as careful next time.',
      civilian: 'A civilian is dead. The client cancels the contract and the police seal the district.'
    },
    seed: 77
  },
  {
    id: 'dockside',
    number: 2,
    title: 'Dockside',
    district: 'Container Port, 18:05',
    briefing:
      'Hale’s money moved through the port. Tonight his broker, Anton Breg, checks a container of cash on the pier and leaves on the ship at the end of the quay. You have the roof of an old warehouse block. Dock workers everywhere: shoot only Breg.',
    target: {
      name: 'Anton Breg',
      description: 'Royal-blue and white track jacket, faded jeans. Arrives in a black van, checks an open blue container with the foreman, then walks the north edge of the pier to the ship\u2019s gangway. Two bodyguards in black.'
    },
    scene: 'dockside',
    lighting: 'sunset',
    vantage: { eye: { x: 119, y: 19.7, z: -100 }, yaw: -0.74, pitch: -0.08, yawRange: 0.9, pitchMin: -0.7, pitchMax: 0.3, focus: { x: 230, z: -235 } },
    wind: { base: 3.2, gust: 1.8 },
    stars: ['Eliminate the target', 'Headshot', 'One shot, no misses'],
    intel: [
      { at: 0, text: 'Breg just got out of the black van on the pier. Blue and white track jacket.' },
      { at: 8, text: 'He is meeting the foreman at the open blue container. Wait for him to stand still.' },
      { at: 20, text: 'Wind off the water: over 3 m/s. Hold a little into it at this range.' },
      { at: 34, text: 'His two guards in black stay at his side. Do not hit them: only Breg.' },
      { at: 52, text: 'He is heading for the gangway. Once he is aboard, he is gone.' }
    ],
    panicIntel: 'Shot heard. Breg is running for the ship!',
    results: {
      win: 'Breg is down on the pier. The ship sails without him.',
      winHead: 'One shot across the water. Breg never reached the ship.',
      escaped: 'Breg made it aboard. The ship and the money are gone.',
      civilian: 'A dock worker is dead. The port locks down and the contract is void.'
    },
    seed: 202
  },
  {
    id: 'rooftop-gala',
    number: 3,
    title: 'Rooftop Gala',
    district: 'Old Town, 21:40',
    briefing:
      'The money ends with Councillor Mara Voss, who hosts a gala on a rooftop terrace across the plaza. Guests, waiters, string lights. She leaves through the stair door when the speeches end. Back on your first roof, in the dark.',
    target: {
      name: 'Mara Voss',
      description: 'Brown knit sweater dress, belt, brown leather boots. Works the terrace with her bodyguard, speaks at the lectern by the banner, then leaves by the stair door.'
    },
    scene: 'gala',
    lighting: 'dusk',
    vantage: { eye: { x: 0, y: 43.7, z: -1.0 }, yaw: -0.37, pitch: -0.11, yawRange: 1.1, pitchMin: -0.8, pitchMax: 0.3, focus: { x: 58, z: -150 } },
    wind: { base: 1.2, gust: 0.8 },
    stars: ['Eliminate the target', 'Headshot', 'One shot, no misses'],
    intel: [
      { at: 0, text: 'The gala is on the terrace across the plaza, under the string lights. Voss is coming up the stairs now.' },
      { at: 7, text: 'Voss: brown knit dress, belt, brown boots. The tall man at her shoulder is her bodyguard.' },
      { at: 30, text: 'She works the room table by table. Mind the guests around her: no one else gets hurt.' },
      { at: 78, text: 'She is walking to the lectern. During the speech she stands still, facing you.' },
      { at: 110, text: 'The speech is ending. Next she heads for the stair door in the north-west corner.' }
    ],
    panicIntel: 'Shot heard. Voss is heading for the stair door!',
    results: {
      win: 'Voss is down. The gala ends early.',
      winHead: 'One shot in the dark. The terrace goes silent.',
      escaped: 'Voss made it inside. Her security will never let her out on a roof again.',
      civilian: 'A guest is dead. The city wakes up to your face on every screen.'
    },
    seed: 303
  },
  {
    id: 'market-day',
    number: 4,
    title: 'Market Day',
    district: 'Old Town, 10:15',
    briefing:
      'Every container of Breg\u2019s cash passed customs with one signature: Deputy Customs Director Lucien Marek. On Saturdays he shops at the Tanners Row street market like anyone else. Today a courier hands him an envelope at the fruit stall, then a taxi waits for him at the end of the street. You have the roof at the west end. The street is packed: be sure before you fire.',
    target: {
      name: 'Lucien Marek',
      description: 'Red track jacket with white stripes down the sleeves, black track trousers with white piping, white trainers, dark hair. Browses the bakery stall, meets a courier in a beige vest at the striped fruit stall, then walks to the yellow taxi at the far end of the street.'
    },
    scene: 'market',
    lighting: 'morning',
    vantage: { eye: { x: -283, y: 19.7, z: -65 }, yaw: -Math.PI / 2, pitch: -0.24, yawRange: 0.5, pitchMin: -0.75, pitchMax: 0.3, focus: { x: -215, z: -65 } },
    wind: { base: 1.4, gust: 1.0 },
    stars: ['Eliminate the target', 'Headshot', 'One shot, no misses'],
    intel: [
      { at: 0, text: 'Market day on Tanners Row. Marek just walked in under your building. Red track jacket, black track trousers.' },
      { at: 9, text: 'He stops at the bakery stall on the right for a few seconds. Mind the shoppers around him.' },
      { at: 28, text: 'His courier is the man in the beige vest at the blue-and-white fruit stall on the left.' },
      { at: 42, text: 'Nobody else on the street wears red. Check the jacket before you fire.' },
      { at: 57, text: 'Marek is with the courier now. He stands there for about twenty seconds.' },
      { at: 82, text: 'He has the envelope. Next he walks to the yellow taxi at the end of the street. If he gets in, he is gone.' }
    ],
    panicIntel: 'Shot heard. Marek is running for the taxi!',
    results: {
      win: 'Marek is down among the fruit crates. The port has lost its signature.',
      winHead: 'One shot over the market. Marek never reached his taxi.',
      escaped: 'Marek reached the taxi and is gone. By tonight he will be out of the country.',
      civilian: 'A shopper is dead. The market empties, the police close the Old Town and the contract is void.'
    },
    seed: 404
  }
];

/** @param {string} id */
export function missionById(id) {
  return MISSIONS.find((m) => m.id === id) || MISSIONS[0];
}

/** Kept for older imports: the first contract. */
export const HARBOR = MISSIONS[0];
