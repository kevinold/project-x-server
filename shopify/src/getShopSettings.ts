import "source-map-support/register";

import { SNSEvent } from "aws-lambda";
import * as AWS from "aws-sdk";
import * as Shopify from "shopify-api-node";
import { IShop } from "shopify-api-node";

import { IAppInstalledMessage, IAuthCompleteMessage } from "./interfaces";
import { writeShop } from "./lib/dynamodb";
import { Log } from "./lib/log";
import { shopifyClientFactory } from "./lib/shopifyClientFactory";

export async function handlerAsync(
    event: SNSEvent,
    clientFactory: (accessToken: string, shopDomain: string) => Shopify,
    dynamodb: AWS.DynamoDB.DocumentClient,
    sns: AWS.SNS,
): Promise<boolean> {
    // Loop through each record just in case we receive multiple
    for (const record of event.Records) {
        Log.info("Record.Sns", record.Sns);

        const message = JSON.parse(record.Sns.Message) as IAuthCompleteMessage;
        Log.info("Message", message);

        const shopify = clientFactory(message.accessToken, message.shopDomain);

        // TODO The catch() should provider some sort of retry mechanism (i.e. SQS retry, SNS notifications, etc)
        const shop = await shopify.shop.get();
        Log.info(shop);
        await writeShop(dynamodb, shop, message.shopDomain);
        await sendAppInstalledNotification(sns, message.shopDomain, shop);
    }
    return true;
}

// Send the SNS notification that the application has been installed
async function sendAppInstalledNotification(
    sns: AWS.SNS,
    shopDomain: string,
    shop: IShop,
): Promise<AWS.SNS.PublishResponse> {
    const message: IAppInstalledMessage = {
        data: shop,
        event: "app/installed",
        shopDomain,
    };

    const params = {
        Message: JSON.stringify(message),
        TopicArn: process.env.APP_INSTALLED_TOPIC_ARN,
    };

    return sns.publish(params).promise();
}

export async function handler(event: SNSEvent): Promise<boolean> {
    const dynamodb = new AWS.DynamoDB.DocumentClient({ apiVersion: "2012-08-10" });
    const sns = new AWS.SNS({ apiVersion: "2010-03-31" });

    return await handlerAsync(event, shopifyClientFactory, dynamodb, sns);
}
