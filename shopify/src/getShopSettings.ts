import "source-map-support/register";

import { SNSEvent } from "aws-lambda";
import * as AWS from "aws-sdk";
import * as Shopify from "shopify-api-node";
import { IShop } from "shopify-api-node";

import { IAppInstalledMessage, IAuthCompleteMessage } from "./interfaces";
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

async function writeShop(
    dynamodb: AWS.DynamoDB.DocumentClient,
    shop: IShop,
    shopDomain: string,
): Promise<AWS.DynamoDB.UpdateItemOutput> {
    const expressionAttributeValues: any = {};
    const expressionAttributeNames: any = {};

    const updateFields = [];
    let k: keyof IShop;
    for (k in shop) {
        if (shop[k]) {
            let key = (k === "domain" ? "D" : k);
            key = (k === "name" ? "N" : key);
            key = (k === "source" ? "S" : key);
            key = (k === "timezone" ? "T" : key);
            const val = shop[k];

            if ((val === null || val === undefined) && k in ["tax_shipping", "taxes_included", "county_taxes"]) {
                expressionAttributeValues[":" + key] = false;
            } else {
                expressionAttributeValues[":" + key] = val;
            }

            if ((":" + key) in expressionAttributeValues) {
                if (key === k) {
                    updateFields.push(key + " = :" + key);
                } else {
                    updateFields.push("#" + key + " = :" + key);
                    expressionAttributeNames["#" + key] = k;
                }
            }
        }
    }

    const updateExpression = "SET " + updateFields.join(", ");

    const updateParams = {
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        Key: {
            shopDomain,
        },
        TableName: process.env.SHOPS_TABLE || "",
        UpdateExpression: updateExpression,
    };
    Log.info("Update Item", updateParams);
    return dynamodb.update(updateParams).promise();
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
