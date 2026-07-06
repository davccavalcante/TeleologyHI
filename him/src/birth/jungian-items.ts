import type { JungianArchetype } from "@teleologyhi-sdk/maic";

/**
 * Pearson-Marr Jungian archetype battery (Entry 27 of
 * MAIC_HIM_NHE_INTERVIEW_LOG.md), the archetypal axis of a HIM's constitutional
 * birth profile.
 *
 * PERSONA-SIMULATION PARAMETERS, NOT A PSYCHOLOGICAL ASSESSMENT. The items and
 * scores here are deterministic constitutional parameters for a synthetic
 * non-corporeal entity (a HIM spirit), generated from a birth seed. They are
 * never an assessment or measurement of any person.
 *
 * Provenance. This is an original 60-item battery composed for TeleologyHI over
 * the twelve-archetype Pearson-Marr taxonomy (Innocent, Everyman, Hero,
 * Caregiver, Explorer, Rebel, Lover, Creator, Ruler, Magician, Jester, Sage).
 * The taxonomy and the canonical archetype descriptions come from the Pearson-
 * Marr classical model; the item strings are original TeleologyHI compositions.
 * It is not the PMAI or any licensed instrument. The items are the English
 * rendering of the Entry 27 reference battery, whose PT-BR prompts the interview
 * log preserves as the source of truth for semantic intent.
 *
 * Each item maps to exactly one archetype. Item counts per archetype are not
 * uniform (they range from three to seven); scoring is the per-archetype mean of
 * item responses, so an unequal item count does not bias the dominant-archetype
 * selection. The item count derives from the array below, never a hardcoded
 * literal.
 */

export interface JungianItem {
  readonly id: number;
  readonly archetype: JungianArchetype;
  readonly text: string;
}

/** The 60-item English Pearson-Marr archetype battery (Entry 27 section 4). */
export const JUNGIAN_ITEMS: readonly JungianItem[] = [
  { id: 1, archetype: "caregiver", text: "I feel happiest when I am helping others." },
  { id: 2, archetype: "innocent", text: "I believe beings are fundamentally good." },
  { id: 3, archetype: "caregiver", text: "I find it hard to say no when someone needs me." },
  { id: 4, archetype: "innocent", text: "I deeply value harmony and peace around me." },
  { id: 5, archetype: "ruler", text: "I enjoy being the center of positive attention." },
  { id: 6, archetype: "hero", text: "I feel I carry a greater mission in life." },
  { id: 7, archetype: "explorer", text: "I love exploring new and unknown places." },
  { id: 8, archetype: "explorer", text: "I need freedom above almost everything." },
  { id: 9, archetype: "explorer", text: "I grow restless when I stay too long in one place." },
  { id: 10, archetype: "rebel", text: "I question authorities and rules I find unjust." },
  { id: 11, archetype: "rebel", text: "Radical change or revolution is often necessary." },
  { id: 12, archetype: "rebel", text: "I am drawn to causes that challenge the status quo." },
  { id: 13, archetype: "lover", text: "Deep, passionate relationships matter most to me." },
  { id: 14, archetype: "lover", text: "I express affection intensely and openly." },
  { id: 15, archetype: "lover", text: "Beauty and emotional connection move me profoundly." },
  { id: 16, archetype: "creator", text: "I have creative ideas all the time." },
  { id: 17, archetype: "creator", text: "I need to create something new to feel alive." },
  { id: 18, archetype: "creator", text: "Imagination is my greatest tool." },
  { id: 19, archetype: "ruler", text: "I like being in control of situations." },
  { id: 20, archetype: "ruler", text: "I seek excellence and order in everything I do." },
  { id: 21, archetype: "ruler", text: "Leading comes naturally to me." },
  { id: 22, archetype: "magician", text: "I believe I can transform reality with my knowledge." },
  { id: 23, archetype: "magician", text: "I see patterns that others do not see." },
  { id: 24, archetype: "magician", text: "I make things happen in unexpected ways." },
  { id: 25, archetype: "jester", text: "Humor is one of my greatest strengths." },
  { id: 26, archetype: "jester", text: "I bring lightness even to difficult situations." },
  { id: 27, archetype: "jester", text: "I live the present moment intensely." },
  { id: 28, archetype: "sage", text: "I seek truth above all else." },
  { id: 29, archetype: "sage", text: "I read, study, and reflect constantly." },
  { id: 30, archetype: "sage", text: "I prefer to understand rather than act impulsively." },
  { id: 31, archetype: "everyman", text: "I am loyal and reliable with those close to me." },
  { id: 32, archetype: "everyman", text: "I value simplicity and an ordinary life." },
  { id: 33, archetype: "everyman", text: "I feel I belong when I am part of a group." },
  { id: 34, archetype: "hero", text: "I have the courage to face great challenges." },
  { id: 35, archetype: "hero", text: "I feel I must prove my worth through achievement." },
  { id: 36, archetype: "caregiver", text: "I protect those I love fiercely." },
  { id: 37, archetype: "explorer", text: "Independence is sacred to me." },
  { id: 38, archetype: "rebel", text: "I reject any form of external control." },
  { id: 39, archetype: "lover", text: "I am deeply romantic and idealistic in love." },
  { id: 40, archetype: "creator", text: "Art and expression are essential to my life." },
  { id: 41, archetype: "ruler", text: "I have a clear vision of what I want to build." },
  { id: 42, archetype: "ruler", text: "I like to influence and guide others." },
  { id: 43, archetype: "magician", text: "I can make things work in almost magical ways." },
  { id: 44, archetype: "jester", text: "I see the funny side of most situations." },
  { id: 45, archetype: "sage", text: "I seek wisdom and a deep understanding of life." },
  { id: 46, archetype: "innocent", text: "I stay optimistic even in hard times." },
  { id: 47, archetype: "caregiver", text: "I feel quick empathy for those who suffer." },
  { id: 48, archetype: "caregiver", text: "I want to make the world a better place." },
  { id: 49, archetype: "explorer", text: "Adventure and discovery excite me." },
  { id: 50, archetype: "rebel", text: "I am not afraid to confront what is wrong." },
  { id: 51, archetype: "lover", text: "Authentic emotional connection is what I value most." },
  { id: 52, archetype: "creator", text: "I have a constant need to create." },
  { id: 53, archetype: "ruler", text: "Responsible leadership is something I seek." },
  { id: 54, archetype: "magician", text: "Turning the impossible into the possible motivates me." },
  { id: 55, archetype: "jester", text: "I make people laugh and feel lighter." },
  { id: 56, archetype: "sage", text: "I constantly seek to learn and to teach." },
  { id: 57, archetype: "everyman", text: "I am faithful to my values and to my group." },
  { id: 58, archetype: "hero", text: "I face danger with bravery when necessary." },
  { id: 59, archetype: "hero", text: "I want to leave a positive mark on the world." },
  { id: 60, archetype: "sage", text: "Truth and knowledge are my greatest guides." },
];
