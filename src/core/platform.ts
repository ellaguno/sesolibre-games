import { Capacitor } from '@capacitor/core';

/**
 * App nativa de iOS. Ahí no existe Google Play Juegos y la revisión de Apple
 * rechaza textos o enlaces que remitan a otra plataforma (guía 2.3.10), así
 * que se ocultan el ranking de Play Juegos y las invitaciones a Google Play.
 */
export const IS_IOS = Capacitor.getPlatform() === 'ios';
