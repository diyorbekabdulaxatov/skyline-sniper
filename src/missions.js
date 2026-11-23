// @ts-check
// Contracts. Each reuses the same city with its own sniper position (vantage), time of day,
// people (scenes/*.js) and rules. A contract unlocks when the one before it is completed.

/**
 * @typedef {{ at: number, text: string }} Intel
 * @typedef {{
 *   id: string, number: number, title: string, district: string, briefing: string,
 *   target: { name: string, description: string },
 *   scene: 'plaza' | 'dockside' | 'gala' | 'market' | 'construction' | 'pool' | 'park',
 *   lighting: 'golden' | 'sunset' | 'dusk' | 'morning' | 'overcast' | 'noon',
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
  },
  {
    id: 'construction-site',
    number: 5,
    title: 'Construction Site',
    district: 'North Quarter, 16:40',
    briefing:
      'Leon Darrow built the network: his towers washed Hale\u2019s money, Breg moved it and Voss signed his permits. This afternoon he shows two investors his new tower at the Northgate site. You are on the deck of an idle tower crane on the next plot. Builders everywhere in hard hats: only Darrow wears a white one.',
    target: {
      name: 'Leon Darrow',
      description: 'Camel overcoat, dark red shirt, white hard hat. Tours the yard with his foreman and his architect, rides the builders\u2019 hoist up to the open top floor to meet the investors, then leaves in a black SUV outside the south gate.'
    },
    scene: 'construction',
    lighting: 'overcast',
    vantage: { eye: { x: -95.2, y: 42.2, z: -329.4 }, yaw: -1.55, pitch: -0.24, yawRange: 0.75, pitchMin: -0.75, pitchMax: 0.3, focus: { x: 5, z: -330 } },
    wind: { base: 2.4, gust: 1.6 },
    stars: ['Eliminate the target', 'Headshot', 'One shot, no misses'],
    intel: [
      { at: 0, text: 'Darrow is at the site office by the south gate. Camel coat, white hard hat.' },
      { at: 10, text: 'Every builder wears a yellow or orange hat. White is Darrow; blue hats are his guests.' },
      { at: 20, text: 'He stops to watch the concrete pour. The mixer truck is between you and him: wait.' },
      { at: 36, text: 'He is taking the builders\u2019 hoist on the west face up to the open top floor.' },
      { at: 66, text: 'On the top floor he shows the investors the view, facing you. He will talk for about twenty seconds.' },
      { at: 92, text: 'He is going back down. Next stop: his black SUV outside the south gate.' },
      { at: 124, text: 'He is crossing the yard to the gate. If he gets into the SUV, he is gone.' }
    ],
    panicIntel: 'Shot heard. Darrow is running for the hoist and his SUV!',
    results: {
      win: 'Darrow is down on his own site. The network has no money left to wash.',
      winHead: 'One shot from the crane. The tower will carry someone else\u2019s name.',
      escaped: 'Darrow made it to his SUV. By tonight he is out of the country.',
      civilian: 'A builder is dead. The site is sealed off and the contract is void.'
    },
    seed: 505
  },
  {
    id: 'rooftop-pool',
    number: 6,
    title: 'Rooftop Pool',
    district: 'Cassian Hotel, 12:30',
    briefing:
      'Dario Castell carries the network\u2019s cash between its banks and its buyers. Today he is off duty at the pool bar on the roof of the Cassian Hotel: a phone call, a swim, a drink, then the lift down. You have the roof of the glass tower to the south-east, 200 to 240 metres out, with a strong wind gusting across the line. Guests, waiters and a lifeguard everywhere: one shot, only Castell.',
    target: {
      name: 'Dario Castell',
      description: 'White linen shirt, light blue jeans, dark sunglasses. Talks at his lounger, takes a long call at the south railing, wades in the shallow end, has a drink at the bar, then heads for the lift house in the north-west corner.'
    },
    scene: 'pool',
    lighting: 'noon',
    vantage: { eye: { x: -160, y: 97.7, z: 262 }, yaw: 0.64, pitch: -0.17, yawRange: 0.85, pitchMin: -0.9, pitchMax: 0.3, focus: { x: -280, z: 120 } },
    wind: { base: 5.5, gust: 3 },
    stars: ['Eliminate the target', 'Headshot', 'One shot, no misses'],
    intel: [
      { at: 0, text: 'The pool deck is on the Cassian\u2019s roof, straight ahead and below you. Castell is at the loungers on the far side of the pool.' },
      { at: 6, text: 'Castell: white linen shirt, jeans, dark sunglasses. The woman beside him is not part of the contract.' },
      { at: 15, text: 'His phone is ringing. He takes the call at the south railing, facing you, and stands there for about twenty seconds.' },
      { at: 30, text: 'Wind from the west, over 5 m/s and gusting. It pushes your shot to the right: hold a little left, more for a headshot.' },
      { at: 50, text: 'He is going for a swim. In the shallow end only his head and chest are above the water.' },
      { at: 88, text: 'Out of the pool and over to the bar on the north side. He stands at the counter with his back to you.' },
      { at: 118, text: 'He is finishing his drink. Next he walks to the lift house in the north-west corner: once inside, he is gone.' }
    ],
    panicIntel: 'Shot heard. Castell is running for the lift!',
    results: {
      win: 'Castell is down by the pool. The network\u2019s cash stops moving today.',
      winHead: 'One shot through the wind. Castell never reached the lift.',
      escaped: 'Castell took the lift down and is gone. The cash moves on without him.',
      civilian: 'A guest is dead. The hotel locks down and the contract is void.'
    },
    seed: 606
  },
  {
    id: 'park-run',
    number: 7,
    title: 'Park Run',
    district: 'Riverside Park, 19:10',
    briefing:
      'Dorian Kast settles the network\u2019s debts by hand. Every evening at sunset he runs the same loop through Riverside Park with one bodyguard, and a car waits for him at the west gate. You have the roof of the corner block above the park. He hardly ever stands still: lead your shot.',
    target: {
      name: 'Dorian Kast',
      description: 'Red hoodie, black running shorts and tights, white trainers. Runs south along the river, stretches at the fitness bar by the water, then cuts across the lawn to a black sedan at the west gate. His bodyguard runs at his shoulder in grey.'
    },
    scene: 'park',
    lighting: 'sunset',
    vantage: { eye: { x: 37, y: 27.7, z: 257 }, yaw: -0.6, pitch: -0.2, yawRange: 0.72, pitchMin: -0.75, pitchMax: 0.25, focus: { x: 100, z: 170 } },
    wind: { base: 2.2, gust: 1.4 },
    stars: ['Eliminate the target', 'Headshot', 'One shot, no misses'],
    intel: [
      { at: 0, text: 'Kast is on his evening run, coming south along the river. Red hoodie, black shorts. The man in grey is his bodyguard.' },
      { at: 8, text: 'He runs at about 3 m/s. The bullet takes a moment to get there: aim ahead of him, in the direction he is running.' },
      { at: 20, text: 'At this range, hold the cross about one body width in front of his chest. When he runs toward you, he needs less.' },
      { at: 40, text: 'He is slowing for the fitness bar by the water. He stops there to stretch for a few seconds: your standing shot.' },
      { at: 66, text: 'He is running again, across the open lawn toward the west gate. Lead him to the left.' },
      { at: 88, text: 'The car at the west gate is waiting for him. If he gets in, he is gone.' }
    ],
    panicIntel: 'Shot heard. Kast is sprinting for the gate and his car!',
    results: {
      win: 'Kast is down on the lawn. The network has lost its enforcer.',
      winHead: 'One shot through the evening light. Kast never finished his run.',
      escaped: 'Kast reached the car and is gone. Tomorrow he will run somewhere else.',
      civilian: 'A bystander is dead. Police fill the park and the contract is void.'
    },
    seed: 707
  }
];

/** @param {string} id */
export function missionById(id) {
  return MISSIONS.find((m) => m.id === id) || MISSIONS[0];
}

/** Kept for older imports: the first contract. */
export const HARBOR = MISSIONS[0];
