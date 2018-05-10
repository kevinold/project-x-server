import "source-map-support/register";

import { SNSEvent } from "aws-lambda";
import * as Shopify from "shopify-api-node";
import { ICreateScriptTag, IScriptTag, IUpdateScriptTag } from "shopify-api-node";

import { config } from "./config";
import { IAuthCompleteMessage } from "./interfaces";
import { shopifyClientFactory } from "./lib/shopifyClientFactory";

import { Log } from "./lib/log";

export async function handlerAsync(
    event: SNSEvent,
    clientFactory: (accessToken: string, shopDomain: string) => Shopify,
    scriptTags: ICreateScriptTag[],
): Promise<boolean> {
    for (const record of event.Records) {
        Log.info(record.Sns);
        const data = JSON.parse(record.Sns.Message) as IAuthCompleteMessage;
        Log.info("Message", data);

        const shopify = clientFactory(data.accessToken, data.shopDomain);

        // TODO This code needs to be made idempotent
        const currentScriptTags = await allScriptTags(shopify);
        await deleteScriptTags(shopify, currentScriptTags, scriptTags);
        await updateScriptTags(shopify, currentScriptTags, scriptTags);
        await createScriptTags(shopify, currentScriptTags, scriptTags);
    }

    return true;
}

async function allScriptTags(shopify: Shopify): Promise<IScriptTag[]> {
    return shopify.scriptTag.list();
}

// tslint:disable-next-line:max-line-length
async function createScriptTags(shopify: Shopify, currentTags: IScriptTag[], requiredScriptTags: ICreateScriptTag[]): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        const promises: Array<Promise<IScriptTag>> = [];

        Log.info("Checking for ScriptTags that need to be created");
        requiredScriptTags.forEach((tag) => {
            if (!currentTags.some((currentValue, _index, _array) => currentValue.src === tag.src)) {
                Log.info("ScriptTag needs to be created", tag);
                promises.push(shopify.scriptTag.create(tag));
            }
        });

        if (promises.length > 0) {
            Promise.all(promises)
                .then((scriptTag) => {
                    Log.info("ScriptTag created", scriptTag);
                    resolve();
                })
                .catch((err) => {
                    Log.info("ScriptTag failed to create", err);
                    reject(err);
                });
        } else {
            Log.info("No ScriptTags needed creating");
            resolve();
        }
    });
}

// tslint:disable-next-line:max-line-length
async function deleteScriptTags(shopify: Shopify, currentTags: IScriptTag[], requiredScriptTags: ICreateScriptTag[]): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        const promises: Array<Promise<void>> = [];

        Log.info("Checking for ScriptTags that need to be deleted");
        currentTags.forEach((tag) => {
            if (!requiredScriptTags.some((currentValue, _index, _array) => currentValue.src === tag.src)) {
                Log.info("ScriptTag needs to be deleted", tag);
                promises.push(shopify.scriptTag.delete(tag.id));
            }
        });

        if (promises.length > 0) {
            Promise.all(promises)
                .then((scriptTag) => {
                    Log.info("ScriptTag deleted", scriptTag);
                    resolve();
                })
                .catch((err) => {
                    Log.info("ScriptTag failed to delete", err);
                    reject(err);
                });
        } else {
            Log.info("No ScriptTags needed deleting");
            resolve();
        }
    });
}

// tslint:disable-next-line:max-line-length
async function updateScriptTags(shopify: Shopify, currentTags: IScriptTag[], requiredScriptTags: IUpdateScriptTag[]): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        const promises: Array<Promise<IScriptTag>> = [];

        Log.info("Checking for ScriptTags that need to be updated");
        currentTags.forEach((tag) => {
            requiredScriptTags.forEach((currentValue) => {
                let requireUpdate = false;

                if (currentValue.src === tag.src) {
                    if ("event" in currentValue && currentValue.event !== tag.event) {
                        requireUpdate = true;
                    }
                    if ("display_scope" in currentValue && currentValue.display_scope !== tag.display_scope) {
                        requireUpdate = true;
                    }
                }

                if (requireUpdate) {
                    Log.info("ScriptTag needs to be updated", tag);
                    promises.push(shopify.scriptTag.update(tag.id, currentValue));
                }
            });
        });

        if (promises.length > 0) {
            Promise.all(promises)
                .then((scriptTag) => {
                    Log.info("ScriptTag updated", scriptTag);
                    resolve();
                })
                .catch((err) => {
                    Log.info("ScriptTag failed to update", err);
                    reject(err);
                });
        } else {
            Log.info("No ScriptTags needed update");
            resolve();
        }
    });
}

export async function handler(event: SNSEvent): Promise<boolean> {
    return await handlerAsync(event, shopifyClientFactory, config.scriptTags);
}
