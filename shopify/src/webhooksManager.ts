import "source-map-support/register";

import { SNSEvent } from "aws-lambda";
import Shopify = require("shopify-api-node");
import { IWebhook } from "shopify-api-node";

import { config } from "./config";
import { IAuthCompleteMessage, IWebhookConfig } from "./interfaces";
import { shopifyClientFactory } from "./lib/shopifyClientFactory";

function hasWebhookChanged(existingWebhook: IWebhook, newWebhook: IWebhookConfig): boolean {
    return existingWebhook.address !== newWebhook.address
        || existingWebhook.format !== newWebhook.format;
}

async function updateOrRemoveExistingWebhooks(
    webhooks: IWebhookConfig[],
    currentWebhooks: Shopify.IWebhook[],
    shopify: Shopify): Promise<void> {
        // Check the existing webhooks
        for (const existingWebhook of currentWebhooks) {
            const newWebhook = webhooks.find((w) => w.topic === existingWebhook.topic);
            if (newWebhook === undefined) {
                // Removing any that should no longer be installed
                console.log("Removing webhook", existingWebhook);
                await shopify.webhook.delete(existingWebhook.id);
            } else {
                // Updating existing webhooks if they have changed
                if (hasWebhookChanged(existingWebhook, newWebhook)) {
                    console.log("Updating webhook", newWebhook);
                    const { snsTopicArn, ...updateWebhook } = newWebhook;
                    await shopify.webhook.update(existingWebhook.id, updateWebhook);
                } else {
                    console.log("Existing webhook [1]", existingWebhook);
                }
            }
        }
}

async function addNewWebhooks(
    webhooks: IWebhookConfig[],
    currentWebhooks: Shopify.IWebhook[],
    shopify: Shopify): Promise<void> {
        // Check the new webhooks and add them if they don't exist
        for (const newWebhook of webhooks) {
            console.log("New Webhook", newWebhook);

            const existingWebhook = currentWebhooks.find((w) => w.topic === newWebhook.topic);
            if (existingWebhook === undefined) {
                console.log("Adding webhook", newWebhook);
                const { snsTopicArn, ...createWebhook } = newWebhook;
                await shopify.webhook.create(createWebhook);
            } else {
                console.log("Existing webhook [2]", existingWebhook);
            }
    }
}

export async function handlerAsync(
    event: SNSEvent,
    webhooks: IWebhookConfig[],
    clientFactory: (accessToken: string, shopDomain: string) => Shopify,
): Promise<boolean> {
    console.log("Event", event);

    // Loop through all of the records we received
    for (const record of event.Records) {
        console.log("Record.Sns", record.Sns);

        const data = JSON.parse(record.Sns.Message) as IAuthCompleteMessage;
        console.log("Data", data);

        const shopify = clientFactory(data.accessToken, data.shopDomain);

        // Get a list of all existing webhooks
        // TODO - Should this be paginated?
        const currentWebhooks = await shopify.webhook.list();

        console.log("Configured webhooks", webhooks);

        await updateOrRemoveExistingWebhooks(webhooks, currentWebhooks, shopify);
        await addNewWebhooks(webhooks, currentWebhooks, shopify);

        console.log("Webhooks updated");
    }

    return true;
}

export async function handler(event: SNSEvent): Promise<boolean> {
    return await handlerAsync(event, config.webhooks, shopifyClientFactory);
}
