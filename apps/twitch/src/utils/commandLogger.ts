import consola from "consola";

export function info(command: string, username: string, id: string) {
  consola.info({
    message: `[Twitch Event - Command] Executing command ${command} from ${username} (${id})`,
    badge: true,
    timestamp: new Date(),
  });
}
export function success(command: string, username: string, id: string) {
  consola.success({
    message: `[Twitch Event - Command] Successfully executed command ${command} from ${username} (${id})`,
    badge: true,
    timestamp: new Date(),
  });
}

export function error(command: string, username: string, id: string) {
  consola.error({
    message: `[Twitch Event - Command] Error executing command ${command} from ${username} (${id})`,
    badge: true,
    timestamp: new Date(),
  });
}
export function warn(command: string, username: string, id: string) {
  consola.warn({
    message: `[Twitch Event - Command]  Warning executing command ${command} from ${username} (${id})`,
    badge: true,
    timestamp: new Date(),
  });
}
