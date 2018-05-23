import "source-map-support/register";

import { SNSEvent } from "aws-lambda";
import * as AWS from "aws-sdk";
import fetch, { Request, RequestInit, Response } from "node-fetch";

import { IAppInstalledMessage, IAuthCompleteMessage } from "./interfaces";
import { writeShop } from "./lib/dynamodb";
import { IShop } from "./lib/shopify";

import * as GetShopSettingsQueryGQL from "./graphql/GetShopSettingsQuery.graphql";

export async function handlerAsync(
    event: SNSEvent,
    dynamodb: AWS.DynamoDB.DocumentClient,
    sns: AWS.SNS,
    fetchFn: (url: string | Request, init?: RequestInit) => Promise<Response>,
): Promise<boolean> {
    console.log("Event", event);

    // Loop through each record just in case we receive multiple
    for (const record of event.Records) {
        console.log("Record.Sns", record.Sns);

        const message = JSON.parse(record.Sns.Message) as IAuthCompleteMessage;
        console.log("Message", message);

        const resp = await fetchFn(`https://${message.shopDomain}/admin/api/graphql.json`, {
            body: GetShopSettingsQueryGQL,
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/graphql",
                "X-Shopify-Access-Token": message.accessToken,
            },
            method: "POST",
        });

        const json = await resp.json();
        const shop = json.data.shop as IShop;

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

    return await handlerAsync(event, dynamodb, sns, fetch);
}
