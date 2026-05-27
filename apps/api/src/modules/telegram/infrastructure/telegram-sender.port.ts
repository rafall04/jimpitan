/**
 * Purpose: Telegram provider delivery port for bot replies and notification outbox dispatch.
 * Caller: TelegramService and FetchTelegramSender adapter.
 * Deps: None.
 * MainFuncs: Defines safe send-message inputs and provider result shape.
 * SideEffects: None in the port.
 */
export type TelegramSendMessage = {
  chatId: string;
  text: string;
};

export type TelegramSendResult = {
  ok: boolean;
  providerMessageId?: string;
  errorMessage?: string;
};

export interface TelegramSenderPort {
  sendMessage(message: TelegramSendMessage): Promise<TelegramSendResult>;
}
