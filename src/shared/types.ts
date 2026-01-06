/**
 * Re-export types from resources for cleaner imports
 *
 * Components should import types from '@shared/types':
 *   import type { Horse, Feed, Board } from '@shared/types';
 *
 * Server/validation code should import from '@shared/resources':
 *   import { HorseSchema, CreateHorseSchema } from '@shared/resources';
 */

export type {
  Horse,
  Feed,
  DietEntry,
  Board,
  UnitType,

  TimeMode,
  EffectiveTimeMode,
} from './resources';

export {
  TIME_MODES,
  TIME_MODE,
  TIME_MODE_CONFIG,
  DEFAULT_TIME_MODE,
} from './resources';
