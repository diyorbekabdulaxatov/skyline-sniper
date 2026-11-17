// @ts-check
// Contract data. The first contract is the vertical slice: Harbor Plaza at midday.

export const HARBOR = {
  id: 'harbor-plaza',
  number: 1,
  title: 'Harbor Plaza',
  district: 'Financial District, 14:20',
  briefing:
    'Victor Hale launders money for the people who own the harbour. In a few minutes he leaves Meridian Tower, meets a contact at the plaza fountain and walks back to his car. You are on the roof across the avenue. One clean shot, no civilians.',
  target: {
    name: 'Victor Hale',
    description: 'Grey suit, red tie. Leaves Meridian Tower, waits at the fountain, then returns to a black sedan on Meridian Street.'
  },
  stars: ['Eliminate the target', 'Headshot', 'One shot, no misses'],
  /** Crosswind in m/s (positive blows right) and how far gusts swing it. */
  wind: { base: 1.6, gust: 1.2 },
  intel: [
    { at: 0, text: 'Hale is leaving Meridian Tower now. Grey suit, red tie.' },
    { at: 9, text: 'He is crossing to the fountain to meet his contact. Wait for him to stand still.' },
    { at: 22, text: 'The rangefinder reads the distance under the cross. At this range the drop is small.' },
    { at: 40, text: 'If he gets back to his car, the contract is lost.' }
  ]
};
