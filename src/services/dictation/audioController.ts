import { PlaybackController } from './playback';
import { browserSources } from './browserSources';

/** One controller for the whole app: one audio element, one token. */
export const audioController = new PlaybackController({ sources: browserSources });
