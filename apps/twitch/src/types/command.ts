import { ChatClient, ChatMessage } from "@twurple/chat";

export interface TwitchCommand {
  name: string;
  description: string;
  execute(
    client: ChatClient,
    channel: string,
    user: string,
    args: string[],
    msg: ChatMessage
  ): Promise<void>;
}
