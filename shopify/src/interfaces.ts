import { ICreateScriptTag, ICreateWebhook, IShop, WebhookTopic } from "./lib/shopify";

export interface IWebhookConfig extends ICreateWebhook {
    snsTopicArn: string;
}

export interface IShopifyConfig {
    scriptTags: ICreateScriptTag[];
    webhooks: IWebhookConfig[];
}

export interface IBaseMessage {
    shopDomain: string;
    event: WebhookTopic | "app/auth_complete" | "app/installed";
    data: object | null;
}

export interface IAppUninstalledMessage extends IBaseMessage {
    data: IShop;
}

export interface IShopUpdateMessage extends IBaseMessage {
    data: { [pname: string]: string | number | boolean };
}

export interface IOAuthCompleteStepFunction {
    accessToken: string;
    shopDomain: string;
}
